import {
  generateAIAdjustedPlan,
  generatePlanInsights,
  extractDeadlinesFromAnnouncements,
} from '../services/geminiService.js';

export async function handleGetAIPlan(req, res) {
  try {
    const { tasks = [], dailyHours = 4 } = req.body;
    const plan = await generateAIAdjustedPlan(tasks, Number(dailyHours));
    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error handling AI plan:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI plan',
      message: err.message,
    });
  }
}

export async function handleGetAIInsights(req, res) {
  try {
    const { tasks = [], dailyHours = 4 } = req.body;
    const insight = await generatePlanInsights(tasks, Number(dailyHours));
    return res.status(200).json({ success: true, data: { insight } });
  } catch (err) {
    console.error('Error handling AI insights:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI insights',
      message: err.message,
    });
  }
}

export async function handleExtractDeadlines(req, res) {
  try {
    const { announcements = [] } = req.body;
    const extractedList = await extractDeadlinesFromAnnouncements(announcements);
    return res.status(200).json({ success: true, data: extractedList });
  } catch (err) {
    console.error('Error extracting deadlines:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to extract deadlines',
      message: err.message,
    });
  }
}

