const authService = require('../services/auth.service');
const streakService = require('../services/streak.service');

/**
 * Helper to retrieve internal user record from authenticated request
 */
async function getAuthUser(req) {
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
 * Controller for GET /streak
 * Returns the current streak, longest streak, and daily activity status.
 */
async function getStreak(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { timezone, date } = req.query;

    const streakData = await streakService.calculateUserStreak(user.id, {
      timezone: timezone || req.headers['x-timezone'],
      referenceDate: date,
      persist: false,
    });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      ...streakData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /streak/history
 * Returns detailed streak history timeline and weekly calendar matrix.
 */
async function getStreakHistory(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { timezone, date } = req.query;

    const historyData = await streakService.getUserStreakHistory(user.id, {
      timezone: timezone || req.headers['x-timezone'],
      referenceDate: date,
    });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
      },
      ...historyData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for POST /streak/recalculate
 * Explicitly forces a fresh recalculation from database and persists a snapshot.
 */
async function recalculateStreak(req, res, next) {
  try {
    const user = await getAuthUser(req);
    const { timezone, date } = req.body;

    const streakData = await streakService.calculateUserStreak(user.id, {
      timezone: timezone || req.headers['x-timezone'],
      referenceDate: date,
      persist: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Streak recalculated successfully from database records',
      ...streakData,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStreak,
  getStreakHistory,
  recalculateStreak,
};
