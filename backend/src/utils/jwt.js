const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'byjus-streak-leaderboard-super-secure-jwt-secret-key-2026';
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
