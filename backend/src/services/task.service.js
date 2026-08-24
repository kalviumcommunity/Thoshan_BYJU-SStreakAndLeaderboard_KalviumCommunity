const prisma = require('../config/prisma');

/**
 * Default curriculum templates to seed for new users who don't have tasks yet.
 */
const DEFAULT_TASKS = [
  {
    title: 'Calculus: Derivatives & Limits',
    description: 'Master core differentiation techniques and limit theorems',
    category: 'Core Concept',
    time: '9 AM',
    isRecurring: true,
    recurringType: 'daily',
  },
  {
    title: 'Kinematics & Motion Speed Quiz',
    description: 'Solve 10 timed practice questions on 1D/2D kinematics',
    category: 'Quiz Practice',
    time: '10 AM',
    isRecurring: true,
    recurringType: 'daily',
  },
  {
    title: 'Organic Chemistry Reactions',
    description: 'Review reaction mechanisms and complete daily revision notes',
    category: 'Daily Task',
    time: '11 AM',
    isRecurring: true,
    recurringType: 'daily',
  },
  {
    title: 'Weekly Grand Assessment',
    description: 'Comprehensive subject test with instant rank evaluation',
    category: 'Assessment',
    time: '12 PM',
    isRecurring: true,
    recurringType: 'daily',
  },
];

/**
 * Seed default recurring curriculum tasks for a user if they have none.
 * @param {string} userId
 */
async function seedDefaultTasksForUser(userId) {
  const existingCount = await prisma.task.count({ where: { userId } });
  if (existingCount > 0) return;

  for (const t of DEFAULT_TASKS) {
    await prisma.task.create({
      data: {
        userId,
        title: t.title,
        description: t.description,
        category: t.category,
        time: t.time,
        isRecurring: t.isRecurring,
        recurringType: t.recurringType,
      },
    });
  }
}

/**
 * Check if a recurring task is active on a given date.
 * @param {Object} task
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {boolean}
 */
function isTaskActiveOnDate(task, dateString) {
  if (!task.isRecurring) {
    return task.date === dateString;
  }

  // Parse day of week (0=Sun, 1=Mon, ..., 6=Sat) in UTC to prevent timezone skew
  const [year, month, day] = dateString.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = targetDate.getUTCDay();

  switch (task.recurringType) {
    case 'daily':
      return true;

    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case 'weekly':
    case 'custom': {
      if (task.recurringDays) {
        const days = task.recurringDays
          .split(',')
          .map((d) => parseInt(d.trim(), 10))
          .filter((n) => !isNaN(n));
        return days.includes(dayOfWeek);
      }
      // If no specific recurringDays given, default to matching creation day of week
      const createdDay = new Date(task.createdAt).getUTCDay();
      return createdDay === dayOfWeek;
    }

    default:
      return true;
  }
}

/**
 * Create a new task.
 * @param {string} userId - User UUID
 * @param {Object} data - Task data
 * @returns {Promise<Object>}
 */
async function createTask(userId, data) {
  const {
    title,
    description = null,
    category = 'Daily Task',
    time = null,
    date = null,
    isRecurring = false,
    recurringType = 'none',
    recurringDays = null,
  } = data;

  if (!title || typeof title !== 'string' || !title.trim()) {
    const error = new Error('Task title is required');
    error.statusCode = 400;
    throw error;
  }

  const validRecurringTypes = ['none', 'daily', 'weekdays', 'weekly', 'custom'];
  const normalizedRecurringType = validRecurringTypes.includes(recurringType)
    ? recurringType
    : isRecurring
    ? 'daily'
    : 'none';

  const task = await prisma.task.create({
    data: {
      userId,
      title: title.trim(),
      description: description ? description.trim() : null,
      category: category ? category.trim() : 'Daily Task',
      time: time ? time.trim() : null,
      date: isRecurring ? null : date,
      isRecurring: Boolean(isRecurring),
      recurringType: normalizedRecurringType,
      recurringDays: recurringDays ? String(recurringDays).trim() : null,
    },
  });

  return task;
}

/**
 * Get all tasks active on a specific date, merged with completion status for that date.
 * @param {string} userId - User UUID
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {Promise<Array>}
 */
async function getTasksForDate(userId, dateString) {
  // Ensure default curriculum exists
  await seedDefaultTasksForUser(userId);

  // Fetch all tasks for user
  const userTasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  // Filter tasks that should appear on this date
  const activeTasks = userTasks.filter((t) => isTaskActiveOnDate(t, dateString));

  // Fetch completions for this date
  const completions = await prisma.taskCompletion.findMany({
    where: {
      userId,
      date: dateString,
    },
  });

  const completionMap = {};
  for (const c of completions) {
    completionMap[c.taskId] = c.completed;
  }

  // Merge completion status into each task
  return activeTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    time: t.time || '10 AM',
    date: t.date || dateString,
    isRecurring: t.isRecurring,
    recurringType: t.recurringType,
    recurringDays: t.recurringDays,
    status: completionMap[t.id] ? 'DONE' : 'PENDING',
    completed: Boolean(completionMap[t.id]),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

/**
 * Get all raw task definitions for a user.
 * @param {string} userId - User UUID
 * @returns {Promise<Array>}
 */
async function getAllTasks(userId) {
  await seedDefaultTasksForUser(userId);
  return prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single task by ID.
 * @param {string} userId - User UUID
 * @param {string} taskId - Task UUID
 * @returns {Promise<Object>}
 */
async function getTaskById(userId, taskId) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      completions: {
        orderBy: { completedAt: 'desc' },
        take: 30,
      },
    },
  });

  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  return task;
}

/**
 * Update an existing task.
 * @param {string} userId - User UUID
 * @param {string} taskId - Task UUID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>}
 */
async function updateTask(userId, taskId, updateData) {
  // Verify ownership
  const existing = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!existing) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  const {
    title,
    description,
    category,
    time,
    date,
    isRecurring,
    recurringType,
    recurringDays,
  } = updateData;

  const dataToUpdate = {};
  if (title !== undefined) {
    if (!title || !title.trim()) {
      const error = new Error('Task title cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    dataToUpdate.title = title.trim();
  }
  if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
  if (category !== undefined) dataToUpdate.category = category.trim();
  if (time !== undefined) dataToUpdate.time = time ? time.trim() : null;
  if (isRecurring !== undefined) dataToUpdate.isRecurring = Boolean(isRecurring);
  if (recurringType !== undefined) dataToUpdate.recurringType = recurringType;
  if (recurringDays !== undefined) dataToUpdate.recurringDays = recurringDays ? String(recurringDays).trim() : null;
  if (date !== undefined) dataToUpdate.date = isRecurring ? null : date;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: dataToUpdate,
  });

  return updated;
}

/**
 * Delete a task and its completions.
 * @param {string} userId - User UUID
 * @param {string} taskId - Task UUID
 * @returns {Promise<Object>}
 */
async function deleteTask(userId, taskId) {
  const existing = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!existing) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.task.delete({
    where: { id: taskId },
  });

  return { id: taskId, deleted: true };
}

/**
 * Get all task completion states for a given user on a specific date (YYYY-MM-DD).
 * @param {string} userId - User UUID
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {Promise<Record<string, boolean>>}
 */
async function getCompletionsForDate(userId, dateString) {
  const records = await prisma.taskCompletion.findMany({
    where: {
      userId,
      date: dateString,
    },
  });

  const completionMap = {};
  for (const record of records) {
    completionMap[record.taskId] = record.completed;
  }

  return completionMap;
}

/**
 * Toggle or set the completion state of a specific task on a specific date.
 * Enforces uniqueness per (userId, taskId, date) and avoids double-counting points.
 * @param {string} userId - User UUID
 * @param {string} taskId - Task identifier
 * @param {string} dateString - "YYYY-MM-DD"
 * @param {boolean} completed - Desired completion state
 * @returns {Promise<{ completion: object, pointsAwarded: number }>}
 */
async function toggleTaskCompletion(userId, taskId, dateString, completed) {
  // 1. Check existing completion state for this exact user + task + date
  const existing = await prisma.taskCompletion.findUnique({
    where: {
      userId_taskId_date: {
        userId,
        taskId,
        date: dateString,
      },
    },
  });

  const previouslyCompleted = existing ? existing.completed : false;

  // 2. Upsert task completion record for this date
  const completion = await prisma.taskCompletion.upsert({
    where: {
      userId_taskId_date: {
        userId,
        taskId,
        date: dateString,
      },
    },
    update: {
      completed,
      completedAt: new Date(),
    },
    create: {
      userId,
      taskId,
      date: dateString,
      completed,
    },
  });

  let pointsAwarded = 0;

  // 3. Update weekly score and activity points only on state change (prevents double-counting)
  if (completed && !previouslyCompleted) {
    pointsAwarded = 15;

    // Record activity
    await prisma.activity.create({
      data: {
        userId,
        activityType: 'task_completion',
        points: 15,
        metadata: JSON.stringify({ taskId, date: dateString }),
        timestamp: new Date(),
      },
    });

    // Update current week score
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    await prisma.weeklyScore.upsert({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: weekStart,
        },
      },
      update: {
        score: { increment: 15 },
      },
      create: {
        userId,
        weekStartDate: weekStart,
        score: 15,
      },
    });
  }

  return {
    completion,
    pointsAwarded,
  };
}

module.exports = {
  createTask,
  getTasksForDate,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getCompletionsForDate,
  toggleTaskCompletion,
  seedDefaultTasksForUser,
};
