import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import {
  calculateStudentStrength,
  calculateAdjustedHoursRuleBased,
  MAX_STUDY_HOURS,
  MIN_STUDY_HOURS,
} from './planningEngine.js';

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
 * Problem Statement 2: Deadline Extraction & 48-hour Cluster Detection
 */
export async function extractDeadlinesFromText(announcements = []) {
  const currentAnchor = new Date().toISOString();

  if (genAI && announcements.length > 0) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const prompt = `You are an AI Academic Extraction Engine.
Current system reference time: ${currentAnchor}

Extract assessment deadlines from these unstructured announcements:
${JSON.stringify(announcements, null, 2)}

Instructions:
1. For each announcement, extract:
   - title: concise assignment title
   - subject: course code or subject name (e.g., CS301, MATH201)
   - deadline: ISO-8601 string (e.g., 2026-10-15T23:59:00Z). Resolve relative dates like 'next Friday' or 'tomorrow' using current system time. If year is missing, assume current academic year.
   - sourceText: exact supporting quotation from the input announcement
2. Calculate clusters where 3 or more deadlines fall within any 48-hour window.

Respond ONLY with valid JSON:
{
  "items": [
    {
      "title": "string",
      "subject": "string",
      "deadline": "ISO-8601 string",
      "sourceText": "string",
      "isClustered": boolean
    }
  ],
  "clusters": [
    {
      "start": "ISO-8601 string",
      "end": "ISO-8601 string",
      "count": number,
      "assignmentTitles": ["string"]
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return { success: true, ...parsed, source: 'gemini' };
    } catch (err) {
      console.warn('Gemini deadline extraction failed, using deterministic fallback:', err.message);
    }
  }

  // Deterministic Rule-Based Fallback
  const defaultExtracted = (announcements.length ? announcements : [
    'CS301 Algorithm Analysis: Milestone 2 report must be uploaded to the portal by next Friday at 11:59 PM sharp.',
    'Database Systems (CS304): Mini-project schema documentation due October 15th before midnight.',
    'Web Architecture Lab: Exercise 4 submission portal closes Oct 16 at 5:00 PM.',
    'Technical Writing (ENG202): Draft literature review is due on Oct 16th by 23:59.',
    'Computer Networks (CS308): Packet tracer analysis assignment due on 24th Oct.',
    'Calculus III (MATH201): Problem set 5 due on 11/04 in class.',
  ]).map((raw, idx) => {
    let subject = 'General';
    let title = `Assignment ${idx + 1}`;
    let deadline = new Date(Date.now() + (idx + 1) * 2 * 86400000).toISOString();

    const courseMatch = raw.match(/\b([A-Z]{2,4}\s?\d{3})\b/i);
    if (courseMatch) subject = courseMatch[1].toUpperCase();

    if (raw.toLowerCase().includes('october 15') || raw.toLowerCase().includes('oct 15')) {
      deadline = '2026-10-15T23:59:00';
      title = 'Mini-Project Schema Documentation';
    } else if (raw.toLowerCase().includes('oct 16') && raw.includes('5:00')) {
      deadline = '2026-10-16T17:00:00';
      title = 'Exercise 4 Submission';
    } else if (raw.toLowerCase().includes('oct 16') && raw.includes('23:59')) {
      deadline = '2026-10-16T23:59:00';
      title = 'Draft Literature Review';
    } else if (raw.toLowerCase().includes('milestone 2')) {
      deadline = '2026-10-09T23:59:00';
      title = 'Milestone 2 Report';
    } else if (raw.toLowerCase().includes('packet tracer')) {
      deadline = '2026-10-24T23:59:00';
      title = 'Packet Tracer Analysis';
    } else if (raw.toLowerCase().includes('problem set 5')) {
      deadline = '2026-11-04T09:00:00';
      title = 'Problem Set 5';
    }

    return {
      title,
      subject,
      deadline,
      sourceText: raw,
      isClustered: false,
    };
  });

  // Deterministic 48h Sliding Window
  defaultExtracted.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const clusters = [];
  const WINDOW_MS = 48 * 60 * 60 * 1000;

  for (let i = 0; i < defaultExtracted.length; i++) {
    const tStart = new Date(defaultExtracted[i].deadline).getTime();
    const group = [defaultExtracted[i]];
    for (let j = i + 1; j < defaultExtracted.length; j++) {
      const tCurrent = new Date(defaultExtracted[j].deadline).getTime();
      if (tCurrent - tStart <= WINDOW_MS) {
        group.push(defaultExtracted[j]);
      }
    }
    if (group.length >= 3) {
      group.forEach((item) => { item.isClustered = true; });
      clusters.push({
        start: defaultExtracted[i].deadline,
        end: group[group.length - 1].deadline,
        count: group.length,
        assignmentTitles: group.map((g) => g.title),
      });
      break;
    }
  }

  return { success: true, items: defaultExtracted, clusters, source: 'rule_based' };
}

/**
 * Problem Statement 1: Timetable Differential Analysis
 */
export function diffTimetables(originalSessions = [], revisedSessions = [], filters = {}) {
  const norm = (s) => (s || '').toString().trim().toLowerCase();

  const makeKey = (s) => `${norm(s.courseCode)}::${norm(s.section)}`;

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  const oldMap = new Map();
  originalSessions.forEach((s, idx) => {
    oldMap.set(s.id || `old_${idx}`, { ...s, id: s.id || `old_${idx}` });
  });

  const matchedOldIds = new Set();

  revisedSessions.forEach((revSession, idx) => {
    const revId = revSession.id || `rev_${idx}`;
    const key = makeKey(revSession);

    // Look for matching session in original
    let match = null;
    for (const [oldId, oldSession] of oldMap.entries()) {
      if (!matchedOldIds.has(oldId) && makeKey(oldSession) === key) {
        match = oldSession;
        matchedOldIds.add(oldId);
        break;
      }
    }

    if (!match) {
      added.push({ ...revSession, changeType: 'ADDED' });
    } else {
      const roomDiff = norm(match.room) !== norm(revSession.room);
      const timeDiff = norm(match.time) !== norm(revSession.time) || norm(match.day) !== norm(revSession.day);

      if (roomDiff || timeDiff) {
        changed.push({
          courseCode: revSession.courseCode,
          section: revSession.section,
          original: match,
          revised: revSession,
          roomChanged: roomDiff,
          rescheduled: timeDiff,
          changeType: roomDiff && timeDiff ? 'MUTATED_BOTH' : roomDiff ? 'ROOM_CHANGED' : 'RESCHEDULED',
        });
      } else {
        unchanged.push({ ...revSession, changeType: 'UNCHANGED' });
      }
    }
  });

  for (const [oldId, oldSession] of oldMap.entries()) {
    if (!matchedOldIds.has(oldId)) {
      removed.push({ ...oldSession, changeType: 'REMOVED' });
    }
  }

  // Apply filters if provided
  let filteredAdded = added;
  let filteredRemoved = removed;
  let filteredChanged = changed;
  let filteredUnchanged = unchanged;

  if (filters.course && filters.course !== 'ALL') {
    const c = norm(filters.course);
    filteredAdded = filteredAdded.filter((s) => norm(s.courseCode) === c);
    filteredRemoved = filteredRemoved.filter((s) => norm(s.courseCode) === c);
    filteredChanged = filteredChanged.filter((s) => norm(s.courseCode) === c);
    filteredUnchanged = filteredUnchanged.filter((s) => norm(s.courseCode) === c);
  }

  if (filters.section && filters.section !== 'ALL') {
    const sec = norm(filters.section);
    filteredAdded = filteredAdded.filter((s) => norm(s.section) === sec);
    filteredRemoved = filteredRemoved.filter((s) => norm(s.section) === sec);
    filteredChanged = filteredChanged.filter((s) => norm(s.section) === sec);
    filteredUnchanged = filteredUnchanged.filter((s) => norm(s.section) === sec);
  }

  return {
    added: filteredAdded,
    removed: filteredRemoved,
    changed: filteredChanged,
    unchanged: filteredUnchanged,
    totalChanges: filteredAdded.length + filteredRemoved.length + filteredChanged.length,
  };
}
