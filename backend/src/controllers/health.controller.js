/**
 * Health check controller
 */
function getHealth(req, res) {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: "BYJU'S Streak & Leaderboard Backend"
  });
}

module.exports = {
  getHealth
};
