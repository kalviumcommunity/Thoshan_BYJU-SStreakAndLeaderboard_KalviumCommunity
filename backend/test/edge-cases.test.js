const assert = require('assert');
const prisma = require('../src/config/prisma');
const redis = require('../src/config/redis');
const streakService = require('../src/services/streak.service');
const taskService = require('../src/services/task.service');
const leaderboardService = require('../src/services/leaderboard.service');

async function runEdgeCaseTestSuite() {
  console.log('================================================================');
  console.log('  RUNNING BYJU\'S STREAK & LEADERBOARD EDGE-CASE TEST SUITE       ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  let userA = null;
  let userB = null;
  let userC = null;

  try {
    // Clean database before edge-case suite
    await prisma.taskCompletion.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.weeklyScore.deleteMany({});
    await prisma.streakHistory.deleteMany({});
    await prisma.leaderboardCache.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.user.deleteMany({});

    // Setup Test Users
    userA = await prisma.user.create({
      data: {
        firebaseUid: `edge-ua-${Date.now()}`,
        email: `user_a_${Date.now()}@byjus.com`,
        name: 'User Alpha',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });

    userB = await prisma.user.create({
      data: {
        firebaseUid: `edge-ub-${Date.now()}`,
        email: `user_b_${Date.now()}@byjus.com`,
        name: 'User Beta',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    });

    userC = await prisma.user.create({
      data: {
        firebaseUid: `edge-uc-${Date.now()}`,
        email: `user_c_${Date.now()}@byjus.com`,
        name: 'User Gamma',
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
    });

    console.log('--- Section 1: Task Edge Cases & Strict Ownership Isolation ---');

    let taskA = null;
    await test('TaskService: Non-existent task returns 404', async () => {
      try {
        await taskService.getTaskById(userA.id, '00000000-0000-0000-0000-000000000000');
        assert.fail('Should have thrown 404 error');
      } catch (err) {
        assert.strictEqual(err.statusCode, 404);
      }
    });

    await test('TaskService: Creating task with empty title throws 400', async () => {
      try {
        await taskService.createTask(userA.id, { title: '   ' });
        assert.fail('Should have thrown 400 error');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
      }
    });

    await test('TaskService: Creating task with invalid date throws 400', async () => {
      try {
        await taskService.createTask(userA.id, { title: 'Valid Title', isRecurring: false, date: '2026/08/29' });
        assert.fail('Should have thrown 400 error');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
      }
    });

    await test('TaskService: Create valid task for User A', async () => {
      taskA = await taskService.createTask(userA.id, {
        title: 'Alpha Calculus Milestone',
        isRecurring: false,
        date: '2026-08-25',
      });
      assert(taskA.id);
      assert.strictEqual(taskA.userId, userA.id);
    });

    await test('TaskService: Strict ownership - User B cannot view User A\'s task (404)', async () => {
      try {
        await taskService.getTaskById(userB.id, taskA.id);
        assert.fail('User B should not be able to view User A\'s task');
      } catch (err) {
        assert.strictEqual(err.statusCode, 404);
      }
    });

    await test('TaskService: Strict ownership - User B cannot toggle User A\'s task (404)', async () => {
      try {
        await taskService.toggleTaskCompletion(userB.id, taskA.id, '2026-08-25', true);
        assert.fail('User B should not be able to toggle User A\'s task');
      } catch (err) {
        assert.strictEqual(err.statusCode, 404);
      }
    });

    await test('TaskService: First completion awards +15 points', async () => {
      const res = await taskService.toggleTaskCompletion(userA.id, taskA.id, '2026-08-25', true);
      assert.strictEqual(res.completed, true);
      assert.strictEqual(res.pointsDelta, 15);
      assert.strictEqual(res.pointsAwarded, 15);
    });

    await test('TaskService: Idempotent toggle - Duplicate completion awards 0 points', async () => {
      const res = await taskService.toggleTaskCompletion(userA.id, taskA.id, '2026-08-25', true);
      assert.strictEqual(res.completed, true);
      assert.strictEqual(res.pointsDelta, 0);
      assert.strictEqual(res.pointsAwarded, 0);
    });

    await test('TaskService: Uncompleting task reverses points (-15 points)', async () => {
      const res = await taskService.toggleTaskCompletion(userA.id, taskA.id, '2026-08-25', false);
      assert.strictEqual(res.completed, false);
      assert.strictEqual(res.pointsDelta, -15);
    });

    await test('TaskService: Re-completing task awards +15 points again', async () => {
      const res = await taskService.toggleTaskCompletion(userA.id, taskA.id, '2026-08-25', true);
      assert.strictEqual(res.completed, true);
      assert.strictEqual(res.pointsDelta, 15);
    });

    console.log('\n--- Section 2: Streak Algorithm & Calendar Math Edge Cases ---');

    await test('Streak: Zero activity baseline yields currentStreak=0, isAtRisk=false', () => {
      const result = streakService.calculateStreakFromActiveDates([], '2026-08-25');
      assert.strictEqual(result.currentStreak, 0);
      assert.strictEqual(result.longestStreak, 0);
      assert.strictEqual(result.isActiveToday, false);
      assert.strictEqual(result.isAtRisk, false);
    });

    await test('Streak: Multiple tasks on the same date count as 1 active day (deduplication)', () => {
      const dates = ['2026-08-25', '2026-08-25', '2026-08-25'];
      const result = streakService.calculateStreakFromActiveDates(dates, '2026-08-25');
      assert.strictEqual(result.currentStreak, 1);
      assert.strictEqual(result.longestStreak, 1);
      assert.strictEqual(result.isActiveToday, true);
      assert.strictEqual(result.isAtRisk, false);
    });

    await test('Streak: 24-hour grace window - Active yesterday but not today preserves streak with isAtRisk=true', () => {
      const dates = ['2026-08-22', '2026-08-23', '2026-08-24'];
      const result = streakService.calculateStreakFromActiveDates(dates, '2026-08-25');
      assert.strictEqual(result.currentStreak, 3);
      assert.strictEqual(result.longestStreak, 3);
      assert.strictEqual(result.isActiveToday, false);
      assert.strictEqual(result.isAtRisk, true);
    });

    await test('Streak: Missed day (>24h inactivity) resets currentStreak to 0', () => {
      const dates = ['2026-08-22', '2026-08-23'];
      const result = streakService.calculateStreakFromActiveDates(dates, '2026-08-25');
      assert.strictEqual(result.currentStreak, 0);
      assert.strictEqual(result.longestStreak, 2);
      assert.strictEqual(result.isActiveToday, false);
      assert.strictEqual(result.isAtRisk, false);
    });

    await test('Streak: Shift date days handles month rollover correctly', () => {
      assert.strictEqual(streakService.shiftDateDays('2026-02-28', 1), '2026-03-01');
      assert.strictEqual(streakService.shiftDateDays('2026-03-01', -1), '2026-02-28');
      assert.strictEqual(streakService.shiftDateDays('2026-12-31', 1), '2027-01-01');
    });

    await test('Streak: Timezone formatting correctly resolves IANA timezones', () => {
      const kolkataDate = streakService.getTodayInTimezone('Asia/Kolkata');
      const utcDate = streakService.getTodayInTimezone('UTC');
      assert(/^\d{4}-\d{2}-\d{2}$/.test(kolkataDate));
      assert(/^\d{4}-\d{2}-\d{2}$/.test(utcDate));
    });

    console.log('\n--- Section 3: Deterministic 3-Tier Leaderboard Tie-Breaking ---');

    await test('Leaderboard: Deterministic 3-tier tie-breaking (Points -> Streak -> Seniority)', async () => {
      const now = new Date();
      await prisma.activity.deleteMany({});
      await prisma.streakHistory.deleteMany({});

      // User A: 60 pts, streak 5, createdAt 2026-01-01 (Senior)
      await prisma.activity.create({ data: { userId: userA.id, points: 60, activityType: 'quiz', timestamp: now } });
      await prisma.streakHistory.create({ data: { userId: userA.id, streakCount: 5, date: now } });

      // User B: 60 pts, streak 10, createdAt 2026-01-02 -> Higher streak wins over User A and C!
      await prisma.activity.create({ data: { userId: userB.id, points: 60, activityType: 'quiz', timestamp: now } });
      await prisma.streakHistory.create({ data: { userId: userB.id, streakCount: 10, date: now } });

      // User C: 60 pts, streak 5, createdAt 2026-01-03 -> Same streak as User A, but created later (Junior)
      await prisma.activity.create({ data: { userId: userC.id, points: 60, activityType: 'quiz', timestamp: now } });
      await prisma.streakHistory.create({ data: { userId: userC.id, streakCount: 5, date: now } });

      const lb = await leaderboardService.getLeaderboard('day', { bypassCache: true });
      assert.strictEqual(lb.totalLearners, 3);

      // Rank #1 must be User B (Highest streak: 10)
      assert.strictEqual(lb.podium[0].userId, userB.id);
      assert.strictEqual(lb.podium[0].rank, 1);
      assert.strictEqual(lb.podium[0].streak, 10);

      // Rank #2 must be User A (Equal streak: 5, but created earlier than User C)
      assert.strictEqual(lb.podium[1].userId, userA.id);
      assert.strictEqual(lb.podium[1].rank, 2);

      // Rank #3 must be User C (Equal streak: 5, but created latest)
      assert.strictEqual(lb.podium[2].userId, userC.id);
      assert.strictEqual(lb.podium[2].rank, 3);
    });

    console.log('\n--- Section 4: Redis Resilience & Cache Invalidation ---');

    await test('Redis: Invalidation handles arrays of timeframe keys safely', async () => {
      await leaderboardService.invalidateLeaderboardCache(['day', 'week', 'month', 'all_time']);
      assert(true);
    });

    await test('Redis: Offline fallback executes seamlessly without crashing requests', async () => {
      const data = await leaderboardService.getLeaderboard('week');
      assert.strictEqual(data.success, true);
      assert(data.source === 'cache' || data.source === 'database');
      assert(Array.isArray(data.podium));
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

  console.log('\n================================================================');
  console.log(`  EDGE-CASE TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runEdgeCaseTestSuite();
