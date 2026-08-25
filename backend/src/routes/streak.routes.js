const express = require('express');
const { verifyFirebaseToken } = require('../middlewares/auth.middleware');
const streakController = require('../controllers/streak.controller');

const router = express.Router();

// Apply auth middleware to all streak routes
router.use(verifyFirebaseToken);

// Streak endpoints
router.get('/', streakController.getStreak);
router.get('/history', streakController.getStreakHistory);
router.post('/recalculate', streakController.recalculateStreak);

module.exports = router;
