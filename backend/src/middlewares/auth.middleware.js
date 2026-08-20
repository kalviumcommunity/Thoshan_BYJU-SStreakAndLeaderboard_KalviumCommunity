const { auth } = require('../config/firebase');

/**
 * Firebase Auth Verification Middleware
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Attaches the decoded user payload to req.user on success.
 */
async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token missing. Expected Authorization: Bearer <token>'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header malformed. Expected format: Bearer <token>'
      });
    }

    const token = authHeader.split('Bearer ')[1].trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is empty. Expected format: Bearer <token>'
      });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);

    // Attach decoded user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      emailVerified: decodedToken.email_verified || false,
      firebase: decodedToken
    };

    next();
  } catch (error) {
    // Distinct error handling based on Firebase error codes
    switch (error.code) {
      case 'auth/id-token-expired':
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Firebase ID token has expired. Please refresh the token on the client and try again.'
        });

      case 'auth/id-token-revoked':
        return res.status(401).json({
          success: false,
          code: 'TOKEN_REVOKED',
          message: 'Firebase ID token has been revoked. Please sign in again.'
        });

      case 'auth/invalid-id-token':
      case 'auth/argument-error':
        return res.status(401).json({
          success: false,
          code: 'INVALID_TOKEN',
          message: 'Invalid Firebase ID token provided.'
        });

      case 'auth/user-disabled':
        return res.status(403).json({
          success: false,
          code: 'USER_DISABLED',
          message: 'The user account associated with this token has been disabled.'
        });

      default:
        return res.status(401).json({
          success: false,
          code: 'AUTH_FAILED',
          message: `Authentication failed: ${error.message}`
        });
    }
  }
}

module.exports = {
  verifyFirebaseToken
};
