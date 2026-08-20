const authService = require('../services/auth.service');

/**
 * Controller for POST /auth/sync
 * Called right after client-side Firebase signup or login.
 * Creates or updates the user record in PostgreSQL.
 */
async function syncUser(req, res, next) {
  try {
    const { uid, email, name: tokenName } = req.user;
    const { name: bodyName } = req.body || {};

    const displayName = bodyName || tokenName || null;

    const { user, isNewUser } = await authService.syncUser({
      firebaseUid: uid,
      email: email,
      name: displayName
    });

    return res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? 'User created and synced successfully' : 'User profile synced successfully',
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /profile (or GET /auth/profile)
 * Protected route that looks up the user in PostgreSQL by req.user.uid (firebaseUid).
 * Returns 404 if the user hasn't been synced to PostgreSQL yet.
 */
async function getProfile(req, res, next) {
  try {
    const { uid } = req.user;

    const user = await authService.getUserByFirebaseUid(uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found in database. Please sync your account via POST /auth/sync.'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        latestStreak: user.streakHistory && user.streakHistory[0] ? user.streakHistory[0] : null,
        weeklyScore: user.weeklyScores && user.weeklyScores[0] ? user.weeklyScores[0] : null
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  syncUser,
  getProfile
};
