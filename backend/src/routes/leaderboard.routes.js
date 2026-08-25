const express = require('express');
const { verifyFirebaseToken } = require('../middlewares/auth.middleware');
const leaderboardController = require('../controllers/leaderboard.controller');

const router = express.Router();

// Public / optional auth leaderboard
router.get('/', (req, res, next) => {
  if (req.headers.authorization) {
    return verifyFirebaseToken(req, res, next);
  }
  next();
}, leaderboardController.getLeaderboard);

// Protected user rank endpoint
router.get('/me', verifyFirebaseToken, leaderboardController.getMyRank);

// Admin / manual cache refresh
router.post('/refresh', verifyFirebaseToken, leaderboardController.refreshLeaderboard);

module.exports = router;
