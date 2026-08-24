const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { verifyFirebaseToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Rate limiter for authentication endpoints against brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication requests from this IP. Please try again after 15 minutes.',
  },
});

// Public authentication endpoints
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Protected authentication endpoints
router.get('/me', verifyFirebaseToken, authController.getMe);
router.post('/logout', verifyFirebaseToken, authController.logout);
router.post('/sync', verifyFirebaseToken, authController.syncUser);
router.get('/profile', verifyFirebaseToken, authController.getProfile);

module.exports = router;
