require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// ─────────────────────────────────────────────
// CORS Configuration
// In Docker, the frontend Nginx container is the only client —
// all browser requests go through Nginx at FRONTEND_URL.
// In development (no FRONTEND_URL set), allow localhost origins.
// ─────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost', 'http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin header) and Nginx proxy calls
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin '${origin}' is not allowed.`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "BYJU'S Streak & Leaderboard Engine API",
    version: '1.0.0'
  });
});

// API Routes
app.use(routes);

// 404 Catch-all handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
