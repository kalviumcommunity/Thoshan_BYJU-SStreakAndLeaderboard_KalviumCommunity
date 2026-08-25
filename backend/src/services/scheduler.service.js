const leaderboardService = require('./leaderboard.service');

let refreshInterval = null;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Initialize background scheduled tasks (e.g. hourly leaderboard cache warming).
 */
function initScheduler() {
  if (refreshInterval) return;

  console.log('[Scheduler] Initializing background jobs (Hourly Leaderboard Refresh)...');

  // Trigger initial cache warming on server startup
  leaderboardService.refreshAllLeaderboards().catch((err) => {
    console.warn('[Scheduler] Initial leaderboard warming deferred:', err.message);
  });

  // Schedule recurring hourly job
  refreshInterval = setInterval(() => {
    console.log('[Scheduler] Triggering scheduled hourly leaderboard refresh...');
    leaderboardService.refreshAllLeaderboards().catch((err) => {
      console.error('[Scheduler] Hourly leaderboard job failed:', err.message);
    });
  }, ONE_HOUR_MS);
}

/**
 * Stop scheduler on graceful shutdown.
 */
function stopScheduler() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[Scheduler] Background jobs stopped.');
  }
}

module.exports = {
  initScheduler,
  stopScheduler,
};
