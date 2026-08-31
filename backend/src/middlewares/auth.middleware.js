const { auth } = require('../config/firebase');
const { verifyToken } = require('../utils/jwt');

/**
 * Dual Authentication Middleware
 * Supports both custom local JWT tokens and Firebase ID tokens.
 * Attaches authenticated user context to `req.user`.
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authorization header is missing. Please provide a Bearer token.',
    });
  }

  const rawHeader = authHeader.trim();
  if (!rawHeader.startsWith('Bearer ') && rawHeader !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Malformed Authorization header. Expected format: Bearer <token>',
    });
  }

  const token = rawHeader.slice(6).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Bearer token is empty. Please provide a valid token.',
    });
  }

  // 1. Try verifying as local application JWT
  try {
    const decodedJwt = verifyToken(token);
    if (decodedJwt && decodedJwt.id) {
      req.user = {
        id: decodedJwt.id,
        uid: decodedJwt.id, // compatibility alias
        email: decodedJwt.email,
        name: decodedJwt.name,
      };
      return next();
    }
  } catch (jwtErr) {
    // If it was explicitly an expired local JWT, return token expired immediately
    if (jwtErr.code === 'TOKEN_EXPIRED' && !token.startsWith('eyJhbGciOiJSUzI1Ni')) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired. Please log in again.',
      });
    }
  }

  // 2. Try verifying as Firebase ID token
  try {
    const decodedFirebaseToken = await auth.verifyIdToken(token);
    req.user = decodedFirebaseToken;
    return next();
  } catch (firebaseErr) {
    if (firebaseErr.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Firebase authentication token has expired. Please log in again.',
      });
    }

    if (firebaseErr.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_REVOKED',
        message: 'Authentication token has been revoked. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or unauthorized authentication token.',
    });
  }
}

module.exports = {
  verifyFirebaseToken,
  authenticate: verifyFirebaseToken,
};
