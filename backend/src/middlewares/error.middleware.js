/**
 * Centralized Error Handling Middleware
 * Ensures all API errors return a consistent JSON shape:
 * { success: false, message: "..." }
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (statusCode === 500) {
    console.error('[Unhandled Server Error]', err);
    // Sanitize message in production to prevent leaking db connection details
    if (process.env.NODE_ENV === 'production' || !err.statusCode) {
      message = 'An unexpected server error occurred. Please try again later.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(err.code ? { code: err.code } : {})
  });
}

/**
 * 404 Not Found Middleware for unmatched routes
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
