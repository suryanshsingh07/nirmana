import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import {
  calculateStudentStrength,
  calculateAdjustedHoursRuleBased,
  MAX_STUDY_HOURS,
  MIN_STUDY_HOURS,
} from './planningEngine.js';
import {
  extractAllAnnouncementsRuleBased,
  analyzeDeadlineAmbiguity,
  extractExplicitTime,
} from './deadlineExtractionEngine.js';

const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;

/**
 * Gemini AI-powered study hour planning.
 * Analyzes task data with Gemini 2.0 Flash and returns intelligent hour adjustments.
 * Falls back to rule-based engine if API key is not configured or fails.
 *
 * @param {Array} tasks - User tasks
 * @param {number} baseDailyHours - Target base daily study hours
 * @returns {Promise<Object>}
 */
export async function generateAIAdjustedPlan(tasks = [], baseDailyHours = 4) {
  const studentStrength = calculateStudentStrength(tasks);
  const activeTasks = (tasks || []).filter((t) => t.status !== 'completed');
  const cappedDailyHours = Math.min(baseDailyHours, MAX_STUDY_HOURS);

  if (!genAI) {
    return {
      ...calculateAdjustedHoursRuleBased(tasks, cappedDailyHours, studentStrength),
      source: 'rule_based',
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const taskSummaries = activeTasks.map((t) => ({
      name: t.name,
      subject: t.subject || t.name,
      type: t.type,
      deadline: t.deadline,
      estimatedHours: t.estimatedHours,
      completedHours: t.completedHours || 0,
      difficulty: t.difficulty,
      priority: t.priority,
      proficiency: t.proficiencyLevel || 'intermediate',
    }));

    const prompt = `You are an AI Academic Study Planner for a student app called PlanIt / Actify.

STUDENT PROFILE:
- Overall strength: ${studentStrength.label} (score: ${(studentStrength.score * 100).toFixed(0)}%)
- Base daily study capacity: ${cappedDailyHours} hours
- Maximum allowed daily study hours: ${MAX_STUDY_HOURS} hours

ACTIVE TASKS:
${JSON.stringify(taskSummaries, null, 2)}

RULES:
1. Daily study hours MUST NOT exceed ${MAX_STUDY_HOURS} hours.
2. For WEAK students (low strength score): recommend MORE daily study hours (closer to max).
3. For STRONG students (high strength score): recommend FEWER daily study hours (they're efficient).
4. For subjects where proficiency is "beginner" or "intermediate": allocate MORE study time for that task.
5. For subjects where proficiency is "advanced" or "expert": allocate LESS study time for that task.
6. Consider deadline urgency — closer deadlines need more daily allocation.
7. The adjusted hours per task should reflect the actual time this specific student needs based on their proficiency.

Respond with ONLY valid JSON, no markdown, no code fences:
{
  "adjustedDailyHours": <number between ${MIN_STUDY_HOURS} and ${MAX_STUDY_HOURS}>,
  "taskAllocations": [
    {
      "taskName": "<task name>",
      "originalHours": <original estimated hours>,
      "adjustedHours": <AI-adjusted total hours needed>,
      "dailyAllocation": <recommended hours per day for this task>,
      "reasoning": "<brief explanation>"
    }
  ],
  "overallTip": "<one sentence coaching tip for this student>"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const aiPlan = JSON.parse(cleanJson);

    aiPlan.adjustedDailyHours = Math.min(aiPlan.adjustedDailyHours || cappedDailyHours, MAX_STUDY_HOURS);
    aiPlan.studentStrength = studentStrength;
    aiPlan.source = 'gemini';

    return aiPlan;
  } catch (err) {
    console.error('Gemini AI planning failed on server, falling back to rule-based:', err.message);
    return {
      ...calculateAdjustedHoursRuleBased(tasks, cappedDailyHours, studentStrength),
      source: 'rule_based_fallback',
    };
  }
}

/**
 * Get personalized coaching tips based on current tasks and risks.
 *
 * @param {Array} tasks - User tasks
 * @param {number} dailyHours - Daily study hours
 * @returns {Promise<string>}
 */
export async function generatePlanInsights(tasks = [], dailyHours = 4) {
  if (!genAI) {
    const overLoaded = tasks.some((t) => {
      const remaining = (t.estimatedHours || 0) - (t.completedHours || 0);
      const deadline = new Date(t.deadline);
      const diff = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
      return remaining / Math.max(1, diff) > dailyHours * 0.8;
    });

    const beginnerTasks = tasks.filter(
      (t) => t.proficiencyLevel === 'beginner' && t.status !== 'completed'
    );
    if (beginnerTasks.length > 0) {
      return `🌱 Focus on "${beginnerTasks[0].name}" — you're still building command here. Dedicate extra time!`;
    }

    if (overLoaded) {
      return '⚠️ High workload detected! Prioritize your most urgent deadline and consider increasing your study capacity.';
    }
    return '✅ Your schedule looks balanced. Stick to the daily breakdown!';
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      You are an AI Academic Coach for PlanIt / Actify. Here are the user's current tasks:
      ${JSON.stringify(
        tasks.map((t) => ({
          name: t.name,
          subject: t.subject || t.name,
          deadline: t.deadline,
          hours: t.estimatedHours,
          done: t.completedHours,
          proficiency: t.proficiencyLevel || 'intermediate',
          difficulty: t.difficulty,
        }))
      )}
      Daily study capacity: ${dailyHours} hours (max 15h allowed).
      
      Consider the student's proficiency level per subject:
      - Beginner: they need MORE study time and simpler explanations
      - Expert: they need LESS time and can handle advanced work
      
      Provide ONE short (max 25 words), actionable coaching tip. Be encouraging but direct about risks.
      Focus on which subject needs most attention based on proficiency and deadlines.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('AI Insights failed on server:', err.message);
    return 'Keep up the good work! Focus on one task at a time.';
  }
}

/**
 * Extract structured deadline information from up to 6 messy announcements using Gemini AI
 * with full fallback to deterministic extraction engine.
 *
 * @param {Array<string>} announcements - Array of announcement strings
 * @returns {Promise<Array<Object>>}
 */
export async function extractDeadlinesFromAnnouncements(announcements = []) {
  if (!genAI) {
    console.log('Gemini API key not configured. Using deterministic extraction engine.');
    return extractAllAnnouncementsRuleBased(announcements);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert AI Data Extractor for academic announcements.
Your job is to extract structured deadline data from messy, unstructured student announcements.

INSTRUCTIONS:
1. For each announcement, extract:
   - "title": Assignment or lab or project title (e.g., "DBMS Assignment 2", "OS Lab Report").
   - "subject": Course or subject name (e.g., "Database Management Systems", "Operating Systems").
   - "deadlineDate": Exact deadline date in YYYY-MM-DD format if present/calculated. If year is missing or ambiguous, provide best guess in YYYY-MM-DD.
   - "deadlineTime": Time if explicitly provided in announcement (HH:MM in 24-hour format, e.g. "10:00" or "23:59"). If no time provided, return null.
   - "hasExplicitTime": boolean true if exact time (e.g. 10:00 AM) was explicitly written in text, false otherwise.
   - "supportingSource": The exact original text sentence or snippet from the announcement supporting this extracted deadline/title.

2. CRITICAL - DO NOT INVENT INFORMATION:
   If a field cannot be confidently extracted, set it to empty string or null.

3. ANNOUNCEMENTS TO PROCESS:
${JSON.stringify(announcements, null, 2)}

Respond ONLY with valid JSON array containing objects matching this schema:
[
  {
    "title": "...",
    "subject": "...",
    "deadlineDate": "YYYY-MM-DD" or null,
    "deadlineTime": "HH:MM" or null,
    "hasExplicitTime": false,
    "supportingSource": "..."
  }
]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extractedList = JSON.parse(cleanJson);

    // Run deterministic ambiguity analysis on AI results for 100% safety
    return announcements.map((origText, idx) => {
      const aiItem = extractedList[idx] || {};
      const cleanOrig = (origText || '').trim();

      if (!cleanOrig) {
        return extractAllAnnouncementsRuleBased([''])[0];
      }

      // Check original text for ambiguity using rule engine
      const explicitTime = extractExplicitTime(cleanOrig) || aiItem.deadlineTime || null;
      const hasExplicitTime = !!explicitTime;
      const ambiguityInfo = analyzeDeadlineAmbiguity(cleanOrig, aiItem.deadlineDate, explicitTime);

      const title = aiItem.title || `Assignment ${idx + 1}`;
      const subject = aiItem.subject || 'General';
      let supportingSource = aiItem.supportingSource || cleanOrig;
      if (supportingSource.length > 150) supportingSource = supportingSource.slice(0, 147) + '...';

      let deadlineDate = aiItem.deadlineDate || ambiguityInfo.suggestedDate || '';

      return {
        id: `announcement_${idx + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        announcementIndex: idx,
        originalText: cleanOrig,
        title: title,
        subject: subject,
        deadlineDate: deadlineDate,
        deadlineTime: explicitTime,
        hasExplicitTime: hasExplicitTime,
        supportingSource: supportingSource,
        status: ambiguityInfo.status,
        ambiguityType: ambiguityInfo.ambiguityType,
        detectedPhrase: ambiguityInfo.detectedPhrase || null,
        suggestedDate: ambiguityInfo.suggestedDate || null,
        suggestedYear: ambiguityInfo.suggestedYear || null,
        conflictingDates: ambiguityInfo.conflictingDates || null,
        ambiguousOptions: ambiguityInfo.ambiguousOptions || null,
        message: ambiguityInfo.message || null,
      };
    });
  } catch (err) {
    console.error('Gemini extraction failed, falling back to rule engine:', err.message);
    return extractAllAnnouncementsRuleBased(announcements);
  }
}

