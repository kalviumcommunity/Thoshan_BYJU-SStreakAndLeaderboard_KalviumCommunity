const authService = require('../services/auth.service');

/**
 * Controller for POST /auth/register
 * Register a new user with email, password, and optional display name.
 */
async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    const result = await authService.registerUser({
      email,
      password,
      name,
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for POST /auth/login
 * Authenticate user with email and password.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await authService.loginUser({
      email,
      password,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /auth/me
 * Retrieve the profile of the authenticated user.
 */
async function getMe(req, res, next) {
  try {
    const userId = req.user.id || req.user.uid;
    let user = await authService.getUserById(userId);

    if (!user && req.user.uid) {
      user = await authService.getUserByFirebaseUid(req.user.uid);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for POST /auth/logout
 */
async function logout(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for POST /auth/sync
 * Syncs a Firebase-authenticated user into the database.
 */
async function syncUser(req, res, next) {
  try {
    const { uid, email, name: tokenName } = req.user;
    const { name: bodyName } = req.body;

    const displayName = bodyName || tokenName || null;
    const userEmail = email || req.body.email;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for user sync',
      });
    }

    const { user, isNewUser } = await authService.syncUser({
      firebaseUid: uid,
      email: userEmail,
      name: displayName,
    });

    return res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? 'User created and synced successfully' : 'User synced successfully',
      isNewUser,
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for GET /auth/profile
 * Retrieves the profile of the authenticated user by Firebase UID or ID.
 */
async function getProfile(req, res, next) {
  try {
    const { uid } = req.user;
    let user = await authService.getUserByFirebaseUid(uid);

    if (!user && req.user.id) {
      user = await authService.getUserById(req.user.id);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found in database',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  logout,
  syncUser,
  getProfile,
};
