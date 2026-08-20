const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyFirebaseToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /auth/sync (Protected: verifies token and syncs user to Postgres)
router.post('/sync', verifyFirebaseToken, authController.syncUser);

// GET /auth/profile (Protected: retrieves user profile from Postgres)
router.get('/profile', verifyFirebaseToken, authController.getProfile);

module.exports = router;
