const app = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`  BYJU'S Streak Engine API Backend`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===========================================`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Initiating graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('[Prisma] Database connection closed.');
    } catch (e) {
      console.error('[Prisma] Error during disconnect:', e);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
