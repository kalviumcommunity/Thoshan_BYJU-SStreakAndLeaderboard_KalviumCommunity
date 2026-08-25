const authService = require('../services/auth.service');
const taskService = require('../services/task.service');

/**
 * Helper to retrieve internal user record from Firebase token
 */
async function getAuthUser(req) {
  if (!req.user) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }

  const userId = req.user.id;
  const firebaseUid = req.user.uid;

  let user = null;
  if (userId) {
    user = await authService.getUserById(userId);
  }
  if (!user && firebaseUid) {
    user = await authService.getUserByFirebaseUid(firebaseUid);
  }

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return user;
}

/**
 * Controller for POST /tasks
 * Create a new task (one-time or recurring).
 */
async function createTask(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const {
      title,
      description,
      category,
      time,
      date,
      isRecurring,
      recurringType,
      recurringDays,
    } = req.body;

    const task = await taskService.createTask(user.id, {
      title,
      description,
      category,
      time,
      date,
      isRecurring,
      recurringType,
      recurringDays,
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /tasks
 * If query param `date=YYYY-MM-DD` is supplied, returns active tasks for that date with completion statuses.
 * Otherwise, returns all task definitions for the user.
 */
async function getTasks(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { date: dateParam } = req.query;

    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date parameter. Expected YYYY-MM-DD format.',
        });
      }

      const tasks = await taskService.getTasksForDate(user.id, dateParam);
      return res.status(200).json({
        success: true,
        date: dateParam,
        count: tasks.length,
        tasks,
      });
    }

    const tasks = await taskService.getAllTasks(user.id);
    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /tasks/:id
 * Retrieve a specific task by ID.
 */
async function getTaskById(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { id } = req.params;

    const task = await taskService.getTaskById(user.id, id);
    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for PUT /tasks/:id
 * Update an existing task.
 */
async function updateTask(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { id } = req.params;

    const task = await taskService.updateTask(user.id, id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for DELETE /tasks/:id
 * Delete a task.
 */
async function deleteTask(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { id } = req.params;

    await taskService.deleteTask(user.id, id);
    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /tasks/completions?date=YYYY-MM-DD
 * Returns completion state map for the authenticated user on the requested date.
 */
async function getCompletions(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const dateParam = req.query.date;

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameter. Expected YYYY-MM-DD format.',
      });
    }

    const completions = await taskService.getCompletionsForDate(user.id, dateParam);

    return res.status(200).json({
      success: true,
      date: dateParam,
      completions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for POST /tasks/toggle
 * Body: { taskId: string, date: "YYYY-MM-DD", completed: boolean }
 */
async function toggleCompletion(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { taskId, date: dateParam, completed, timezone } = req.body;
    const clientTimezone = timezone || req.headers['x-timezone'];

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'taskId is required and must be a string',
      });
    }

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({
        success: false,
        message: 'date is required and must be in YYYY-MM-DD format',
      });
    }

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'completed is required and must be a boolean',
      });
    }

    const result = await taskService.toggleTaskCompletion(user.id, taskId, dateParam, completed, clientTimezone);

    return res.status(200).json({
      success: true,
      completion: result.completion,
      pointsAwarded: result.pointsAwarded,
      streak: result.streak,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getCompletions,
  toggleCompletion,
};
