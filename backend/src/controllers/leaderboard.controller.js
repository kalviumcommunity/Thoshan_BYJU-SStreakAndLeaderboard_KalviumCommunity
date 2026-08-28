const authService = require('../services/auth.service');
const leaderboardService = require('../services/leaderboard.service');

/**
 * Helper to retrieve internal user record from authenticated request
 */
async function getAuthUser(req) {
  if (!req.user) return null;
  const userId = req.user.id;
  const firebaseUid = req.user.uid;

  let user = null;
  if (userId) {
    user = await authService.getUserById(userId);
  }
  if (!user && firebaseUid) {
    user = await authService.getUserByFirebaseUid(firebaseUid);
  }
  return user;
}

/**
 * Controller for GET /leaderboard
 * Query params: timeframe=day|week|month|all_time (default: 'week')
 */
async function getLeaderboard(req, res, next) {
  try {
    const timeframe = req.query.timeframe || 'week';
    const leaderboardData = await leaderboardService.getLeaderboard(timeframe);

    let userStanding = null;
    const user = await getAuthUser(req);
    if (user) {
      userStanding = await leaderboardService.getUserRankAndSurroundings(user.id, timeframe, 2);
    }

    return res.status(200).json({
      success: true,
      timeframe: leaderboardData.timeframe,
      periodLabel: leaderboardData.periodLabel,
      source: leaderboardData.source,
      totalLearners: leaderboardData.totalLearners,
      podium: leaderboardData.podium,
      rankings: leaderboardData.rankings,
      userStanding: userStanding
        ? {
            userRank: userStanding.userRank,
            userPoints: userStanding.userPoints,
            userStreak: userStanding.userStreak,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /leaderboard/me
 * Returns the authenticated user's current rank, points, streak, and surrounding peers.
 */
async function getMyRank(req, res, next) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to retrieve user standing',
      });
    }

    const timeframe = req.query.timeframe || 'week';
    const parsedRadius = Number.parseInt(req.query.radius, 10);
    const radius = Math.min(
      Math.max(Number.isFinite(parsedRadius) ? parsedRadius : 3, 1),
      20
    );

    const standing = await leaderboardService.getUserRankAndSurroundings(user.id, timeframe, radius);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      ...standing,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for POST /leaderboard/refresh
 * Explicitly forces a recalculation and warms the cache across all timeframes.
 */
async function refreshLeaderboard(req, res, next) {
  try {
    await leaderboardService.refreshAllLeaderboards();
    return res.status(200).json({
      success: true,
      message: 'Leaderboard recalculation completed and cache warmed successfully',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLeaderboard,
  getMyRank,
  refreshLeaderboard,
};
