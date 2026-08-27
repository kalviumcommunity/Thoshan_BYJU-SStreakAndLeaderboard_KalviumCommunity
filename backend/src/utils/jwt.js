const jwt = require('jsonwebtoken');

// Require JWT_SECRET to be explicitly set — no hardcoded production fallback.
// In development, a clearly-labelled dev-only default is used with a warning.
let JWT_SECRET;
if (process.env.JWT_SECRET) {
  JWT_SECRET = process.env.JWT_SECRET;
} else if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '[JWT] FATAL: JWT_SECRET environment variable is not set. ' +
    'Set a strong random secret before starting the server in production.'
  );
} else {
  // Development-only fallback — never used in production
  JWT_SECRET = 'dev-only-insecure-jwt-secret-do-not-use-in-production';
  console.warn(
    '[JWT] WARNING: JWT_SECRET is not set. Using an insecure dev-only secret. ' +
    'Set JWT_SECRET in your .env file before deploying.'
  );
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT token.
 * @param {Object} payload - Data to embed in the token (e.g. { id, email, name })
 * @returns {string} Signed JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token.
 * @param {string} token - JWT token string
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('JWT token has expired');
      err.code = 'TOKEN_EXPIRED';
      err.statusCode = 401;
      throw err;
    }
    const err = new Error('Invalid JWT token');
    err.code = 'INVALID_TOKEN';
    err.statusCode = 401;
    throw err;
  }
}

module.exports = {
  generateToken,
  verifyToken,
  JWT_SECRET,
};
