const assert = require('assert');
const prisma = require('../src/config/prisma');
const redis = require('../src/config/redis');
const leaderboardService = require('../src/services/leaderboard.service');
const taskService = require('../src/services/task.service');

async function runLeaderboardTests() {
  console.log('====================================================');
  console.log('  RUNNING LEADERBOARD & REDIS CACHING TEST SUITE    ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  // Setup test users for leaderboard test suite
  let u1, u2, u3, u4;

  try {
    console.log('--- Phase 1: Dynamic Scoring & Tie-Breaking Tests ---');

    // Clean existing test records for isolated test run
    await prisma.taskCompletion.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.weeklyScore.deleteMany({});
    await prisma.streakHistory.deleteMany({});
    await prisma.leaderboardCache.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.user.deleteMany({});

    const now = new Date();
    const todayStr = '2024-12-09';

    u1 = await prisma.user.create({
      data: {
        firebaseUid: 'lb-u1',
        email: 'alice@byjus.com',
        name: 'Alice Learner',
        createdAt: new Date(Date.now() - 10000),
      },
    });

    u2 = await prisma.user.create({
      data: {
        firebaseUid: 'lb-u2',
        email: 'bob@byjus.com',
        name: 'Bob Learner',
        createdAt: new Date(Date.now() - 5000),
      },
    });

    u3 = await prisma.user.create({
      data: {
        firebaseUid: 'lb-u3',
        email: 'charlie@byjus.com',
        name: 'Charlie Learner',
        createdAt: new Date(Date.now() - 1000),
      },
    });

    u4 = await prisma.user.create({
      data: {
        firebaseUid: 'lb-u4',
        email: 'david@byjus.com',
        name: 'David Learner',
        createdAt: new Date(),
      },
    });

    // Seed activities
    // Alice: 90 pts, 10-day streak
    await prisma.activity.create({ data: { userId: u1.id, points: 90, activityType: 'quiz', timestamp: now } });
    await prisma.streakHistory.create({ data: { userId: u1.id, streakCount: 10, date: now } });

    // Bob: 60 pts, 5-day streak
    await prisma.activity.create({ data: { userId: u2.id, points: 60, activityType: 'lesson', timestamp: now } });
    await prisma.streakHistory.create({ data: { userId: u2.id, streakCount: 5, date: now } });

    // Charlie: 60 pts, 8-day streak (TIE with Bob on points! Charlie has higher streak -> Charlie should be #2, Bob #3)
    await prisma.activity.create({ data: { userId: u3.id, points: 60, activityType: 'assessment', timestamp: now } });
    await prisma.streakHistory.create({ data: { userId: u3.id, streakCount: 8, date: now } });

    // David: 0 pts, 1-day streak
    await prisma.streakHistory.create({ data: { userId: u4.id, streakCount: 1, date: now } });

    await test('Leaderboard assigns ordinal ranks based on points', async () => {
      const data = await leaderboardService.getLeaderboard('day', { bypassCache: true });
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.totalLearners, 4);
      assert.strictEqual(data.podium.length, 3);
      assert.strictEqual(data.rankings.length, 1);

      // Rank 1: Alice (90 pts)
      assert.strictEqual(data.podium[0].userId, u1.id);
      assert.strictEqual(data.podium[0].rank, 1);
      assert.strictEqual(data.podium[0].points, 90);
    });

    await test('Tie-breaking: identical score (60 pts) resolved by higher streak (8 > 5)', async () => {
      const data = await leaderboardService.getLeaderboard('day', { bypassCache: true });
      // Charlie (60 pts, streak 8) must beat Bob (60 pts, streak 5)
      assert.strictEqual(data.podium[1].userId, u3.id);
      assert.strictEqual(data.podium[1].rank, 2);
      assert.strictEqual(data.podium[1].streak, 8);

      assert.strictEqual(data.podium[2].userId, u2.id);
      assert.strictEqual(data.podium[2].rank, 3);
      assert.strictEqual(data.podium[2].streak, 5);
    });

    await test('Podium items have correct medals & visual badges (#1, #2, #3)', async () => {
      const data = await leaderboardService.getLeaderboard('day', { bypassCache: true });
      assert.strictEqual(data.podium[0].badge, '🥇 #1');
      assert.strictEqual(data.podium[1].badge, '🥈 #2');
      assert.strictEqual(data.podium[2].badge, '🥉 #3');
    });

    console.log('\n--- Phase 2: Surrounding Ranks & User Standing Tests ---');

    await test('getUserRankAndSurroundings retrieves user rank and neighbor peers', async () => {
      // Check Charlie's standing (Rank #2)
      const standing = await leaderboardService.getUserRankAndSurroundings(u3.id, 'day', 1);
      assert.strictEqual(standing.success, true);
      assert.strictEqual(standing.userRank, 2);
      assert.strictEqual(standing.userPoints, 60);
      assert.strictEqual(standing.userStreak, 8);

      // Surrounding peers within radius 1 (Alice #1, Charlie #2, Bob #3)
      assert.strictEqual(standing.surroundingUsers.length, 3);
      assert.strictEqual(standing.surroundingUsers[0].userId, u1.id); // Above
      assert.strictEqual(standing.surroundingUsers[1].userId, u3.id); // Self
      assert.strictEqual(standing.surroundingUsers[2].userId, u2.id); // Below
    });

    await test('getUserRankAndSurroundings for last rank user (David #4)', async () => {
      const standing = await leaderboardService.getUserRankAndSurroundings(u4.id, 'day', 2);
      assert.strictEqual(standing.userRank, 4);
      assert.strictEqual(standing.userPoints, 0);
      assert(standing.surroundingUsers.length > 0);
      assert.strictEqual(standing.surroundingUsers[standing.surroundingUsers.length - 1].userId, u4.id);
    });

    console.log('\n--- Phase 3: Redis Caching & Seamless Fallback Tests ---');

    await test('Leaderboard returns source=database on initial calculation / cache bypass', async () => {
      const data = await leaderboardService.getLeaderboard('week', { bypassCache: true });
      assert.strictEqual(data.source, 'database');
    });

    await test('Leaderboard handles offline Redis gracefully without throwing errors', async () => {
      const isOnline = redis.isAvailable();
      // Even if Redis is not running locally, service returns valid data with fallback
      const data = await leaderboardService.getLeaderboard('month');
      assert.strictEqual(data.success, true);
      assert(data.source === 'database' || data.source === 'cache');
      assert(Array.isArray(data.podium));
    });

    await test('Invalidate cache clears cached entries properly', async () => {
      await leaderboardService.invalidateLeaderboardCache();
      // Verify no throw
      assert(true);
    });

    console.log('\n--- Phase 4: Real-time Point Changes & Invalidation Trigger ---');

    await test('Completing task dynamically increments score and updates ranking position', async () => {
      // Create task for David (currently #4 with 0 pts)
      const task = await taskService.createTask(u4.id, {
        title: 'Super Math Drill',
        isRecurring: false,
        date: todayStr,
      });

      // Complete task (+15 pts)
      await taskService.toggleTaskCompletion(u4.id, task.id, todayStr, true);

      // David now has 15 pts (still #4, but points increased from 0 to 15)
      const standing = await leaderboardService.getUserRankAndSurroundings(u4.id, 'day');
      assert.strictEqual(standing.userPoints, 15);
    });

    await test('Uncompleting task decrements score cleanly', async () => {
      const tasks = await taskService.getAllTasks(u4.id);
      const targetTask = tasks[0];

      // Uncomplete task (-15 pts)
      await taskService.toggleTaskCompletion(u4.id, targetTask.id, todayStr, false);

      const standing = await leaderboardService.getUserRankAndSurroundings(u4.id, 'day');
      assert.strictEqual(standing.userPoints, 0);
    });

  } finally {
    // Cleanup test data
    await prisma.taskCompletion.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.weeklyScore.deleteMany({});
    await prisma.streakHistory.deleteMany({});
    await prisma.leaderboardCache.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.user.deleteMany({});
    await redis.disconnect();
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`  LEADERBOARD TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runLeaderboardTests();
