import { apiRequest } from './api';

/**
 * AI Service for academic coaching and planning insights.
 * Calls backend /api/ai/insights with client-side fallback.
 */

export const getPlanInsights = async (tasks = [], dailyHours = 4) => {
  try {
    const response = await apiRequest('/api/ai/insights', {
      method: 'POST',
      body: JSON.stringify({ tasks, dailyHours }),
    });

    if (response?.data?.insight) {
      return response.data.insight;
    }
    throw new Error('No insight received');
  } catch (err) {
    console.warn('Backend AI insights unavailable, using fallback:', err.message);

    // Fallback rule-based insight
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
};
