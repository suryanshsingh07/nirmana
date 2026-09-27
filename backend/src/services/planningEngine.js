/**
 * Planning Engine Services (Backend)
 * Algorithmic logic for task breakdown, priority calculation,
 * student strength scoring, and daily schedule generation.
 */

export const MAX_STUDY_HOURS = 15;
export const MIN_STUDY_HOURS = 1;

export const PROFICIENCY_MULTIPLIERS = {
  beginner: 1.8,      // Needs 80% more time
  intermediate: 1.2,  // Needs 20% more time
  advanced: 0.9,      // Needs 10% less time
  expert: 0.7,        // Needs 30% less time
};

export const DIFFICULTY_MULTIPLIERS = {
  hard: 1.5,
  medium: 1.0,
  easy: 0.7,
};

export const PRIORITY_WEIGHTS = {
  High: 3, high: 3,
  Medium: 2, medium: 2,
  Low: 1, low: 1,
};

export const DIFFICULTY_WEIGHTS = {
  Hard: 3, hard: 3,
  Medium: 2, medium: 2,
  Easy: 1, easy: 1,
};

/**
 * Calculate overall student strength from their task history.
 * Returns a score from 0 (poor) to 1 (strong).
 * @param {Array} tasks - All user tasks (active + completed)
 * @returns {{ score: number, label: string }}
 */
export function calculateStudentStrength(tasks) {
  if (!tasks || tasks.length === 0) {
    return { score: 0.5, label: 'average' };
  }

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const totalTasks = tasks.length;

  const completionRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

  let onTimeCount = 0;
  completedTasks.forEach((task) => {
    if (task.completedAt && task.deadline) {
      const completedDate = task.completedAt?.toDate
        ? task.completedAt.toDate()
        : new Date(task.completedAt);
      const deadlineDate = new Date(task.deadline + 'T23:59:59');
      if (completedDate <= deadlineDate) onTimeCount++;
    } else {
      onTimeCount += 0.5;
    }
  });
  const onTimeRate = completedTasks.length > 0 ? onTimeCount / completedTasks.length : 0.5;

  let efficiencyScore = 0.5;
  const tasksWithHours = completedTasks.filter((t) => t.estimatedHours && t.completedHours);
  if (tasksWithHours.length > 0) {
    const avgEfficiency =
      tasksWithHours.reduce((sum, t) => {
        const ratio = t.completedHours / t.estimatedHours;
        return sum + Math.min(1, 1 / Math.max(0.5, ratio));
      }, 0) / tasksWithHours.length;
    efficiencyScore = avgEfficiency;
  }

  const score = Math.min(
    1,
    Math.max(
      0,
      completionRate * 0.4 + onTimeRate * 0.35 + efficiencyScore * 0.25
    )
  );

  let label;
  if (score >= 0.8) label = 'strong';
  else if (score >= 0.6) label = 'above_average';
  else if (score >= 0.4) label = 'average';
  else if (score >= 0.2) label = 'below_average';
  else label = 'needs_improvement';

  return { score, label };
}

/**
 * Rule-based fallback: Calculate adjusted study hours for each task.
 * @param {Array} tasks - Active tasks
 * @param {number} baseDailyHours - User's base daily study capacity
 * @param {{ score: number, label: string }} studentStrength - Student's strength profile
 * @returns {{ adjustedDailyHours: number, taskAllocations: Array, reasoning: string }}
 */
export function calculateAdjustedHoursRuleBased(tasks, baseDailyHours, studentStrength) {
  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  if (activeTasks.length === 0) {
    return {
      adjustedDailyHours: Math.min(baseDailyHours, MAX_STUDY_HOURS),
      taskAllocations: [],
      reasoning: 'No active tasks to plan for.',
    };
  }

  let strengthMultiplier;
  if (studentStrength.score >= 0.8) {
    strengthMultiplier = 0.8;
  } else if (studentStrength.score >= 0.6) {
    strengthMultiplier = 0.9;
  } else if (studentStrength.score >= 0.4) {
    strengthMultiplier = 1.0;
  } else if (studentStrength.score >= 0.2) {
    strengthMultiplier = 1.2;
  } else {
    strengthMultiplier = 1.4;
  }

  const adjustedDailyHours = Math.min(
    MAX_STUDY_HOURS,
    Math.max(MIN_STUDY_HOURS, Math.round(baseDailyHours * strengthMultiplier * 2) / 2)
  );

  const taskAllocations = activeTasks.map((task) => {
    const proficiency = task.proficiencyLevel || 'intermediate';
    const difficulty = task.difficulty || 'medium';

    const proficiencyMul = PROFICIENCY_MULTIPLIERS[proficiency] || 1.0;
    const difficultyMul = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;

    const baseHours = parseFloat(task.estimatedHours) || 1;
    const adjustedHours = Math.round(baseHours * proficiencyMul * difficultyMul * 2) / 2;

    const deadline = new Date(task.deadline + 'T23:59:59');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.max(1, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)));
    const urgencyFactor = daysLeft <= 1 ? 2.0 : daysLeft <= 3 ? 1.5 : daysLeft <= 7 ? 1.2 : 1.0;

    return {
      taskId: task.id,
      taskName: task.name,
      subject: task.subject || task.name,
      originalHours: baseHours,
      adjustedHours: Math.round(adjustedHours * urgencyFactor * 2) / 2,
      proficiency,
      proficiencyMultiplier: proficiencyMul,
      dailyAllocation: Math.min(adjustedDailyHours, Math.round((adjustedHours / daysLeft) * 2) / 2),
      daysLeft,
      reasoning: `${proficiency} level -> ${proficiencyMul}x, ${difficulty} difficulty -> ${difficultyMul}x`,
    };
  });

  return {
    adjustedDailyHours,
    taskAllocations,
    studentStrength,
    reasoning:
      `Student strength: ${studentStrength.label} (${(studentStrength.score * 100).toFixed(0)}%). ` +
      `Daily hours adjusted from ${baseDailyHours}h to ${adjustedDailyHours}h.`,
  };
}

/**
 * Calculates a priority score for a task based on urgency, priority, difficulty, and proficiency.
 */
export function calculatePriorityScore(task) {
  const now = new Date();
  const deadline = new Date(task.deadline);

  let diffDays = (deadline - now) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) diffDays = 0.1;
  else if (diffDays < 1) diffDays = 0.5;

  const priorityWeight = PRIORITY_WEIGHTS[task.priority] || 1;
  const difficultyWeight = DIFFICULTY_WEIGHTS[task.difficulty] || 1;
  const proficiencyWeight = PROFICIENCY_MULTIPLIERS[task.proficiencyLevel] || 1.0;

  return (priorityWeight * difficultyWeight * proficiencyWeight * 10) / diffDays;
}
