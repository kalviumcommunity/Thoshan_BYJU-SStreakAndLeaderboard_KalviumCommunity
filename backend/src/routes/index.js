const express = require('express');
const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const authController = require('../controllers/auth.controller');
const { verifyFirebaseToken } = require('../middlewares/auth.middleware');

const taskRoutes = require('./task.routes');

const router = express.Router();

// Health check routes
router.use('/', healthRoutes);

// Auth routes (POST /auth/sync, GET /auth/profile)
router.use('/auth', authRoutes);

// Task routes (GET /tasks/completions?date=YYYY-MM-DD, POST /tasks/toggle)
router.use('/tasks', taskRoutes);

// Direct GET /profile (Protected: returns user profile)
router.get('/profile', verifyFirebaseToken, authController.getProfile);

module.exports = router;
