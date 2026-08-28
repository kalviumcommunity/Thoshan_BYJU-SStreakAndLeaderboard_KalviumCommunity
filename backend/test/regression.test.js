const assert = require('assert');
const prisma = require('../src/config/prisma');
const redis = require('../src/config/redis');
const streakService = require('../src/services/streak.service');
const taskService = require('../src/services/task.service');
const leaderboardService = require('../src/services/leaderboard.service');

async function runRegressionTestSuite() {
  console.log('================================================================');
  console.log('  RUNNING BYJU\'S STREAK & LEADERBOARD REGRESSION TEST SUITE     ');
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

  let testUser = null;
  const testEmail = `regression-${Date.now()}@byjus.com`;
  const todayStr = '2026-08-25';
  const yesterdayStr = '2026-08-24';
  const twoDaysAgoStr = '2026-08-23';
  const threeDaysAgoStr = '2026-08-22';

  try {
    // 0. Setup test user
    testUser = await prisma.user.create({
      data: {
        firebaseUid: `reg-uid-${Date.now()}`,
        email: testEmail,
        name: 'Regression Tester',
      },
    });

    console.log('--- Section 1: Task CRUD & Creation Regression (Part 1) ---');

    let createdTask = null;
    let recurringTask = null;

    await test('TaskService: Successfully create a one-time task', async () => {
      createdTask = await taskService.createTask(testUser.id, {
        title: 'Organic Chemistry Revision',
        description: 'Review reaction mechanisms',
        category: 'Core Concept',
        time: '9 AM',
        date: todayStr,
        isRecurring: false,
      });

      assert(createdTask);
      assert.strictEqual(createdTask.title, 'Organic Chemistry Revision');
      assert.strictEqual(createdTask.date, todayStr);
      assert.strictEqual(createdTask.isRecurring, false);
    });

    await test('TaskService: Successfully create a recurring task', async () => {
      recurringTask = await taskService.createTask(testUser.id, {
        title: 'Daily Math Practice',
        description: 'Complete 10 calculus questions',
        category: 'Daily Task',
        time: '10 AM',
        isRecurring: true,
        recurringType: 'daily',
      });

      assert(recurringTask);
      assert.strictEqual(recurringTask.isRecurring, true);
      assert.strictEqual(recurringTask.recurringType, 'daily');
    });

    await test('TaskService: Fetch tasks for specific date includes completion status', async () => {
      const tasks = await taskService.getTasksForDate(testUser.id, todayStr);
      assert(Array.isArray(tasks));
      assert(tasks.some((t) => t.id === createdTask.id));
      assert(tasks.some((t) => t.id === recurringTask.id));
    });

    await test('TaskService: Update task details', async () => {
      const updated = await taskService.updateTask(testUser.id, createdTask.id, {
        title: 'Updated Organic Chemistry Revision',
        time: '11 AM',
      });
      assert.strictEqual(updated.title, 'Updated Organic Chemistry Revision');
      assert.strictEqual(updated.time, '11 AM');
    });

    console.log('\n--- Section 2: Streak Claim Verification (Part 3 Checklist) ---');

    await test('Same-day multiple completions -> streak count increases by at most 1 for that day', async () => {
      // Toggle first task on todayStr
      await taskService.toggleTaskCompletion(testUser.id, createdTask.id, todayStr, true);
      const res1 = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: todayStr,
        persist: false,
      });
      assert.strictEqual(res1.currentStreak, 1);
      assert.strictEqual(res1.isActiveToday, true);

      // Toggle second task on SAME todayStr
      await taskService.toggleTaskCompletion(testUser.id, recurringTask.id, todayStr, true);
      const res2 = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: todayStr,
        persist: false,
      });
      assert.strictEqual(res2.currentStreak, 1, 'Streak must not increment beyond 1 for multiple completions on same day');
      assert.strictEqual(res2.totalActiveDays, 1);
    });

    await test('Active yesterday, not yet today -> isAtRisk = true, streak preserved in grace window', async () => {
      // Clear today's completions for isolated test
      await prisma.taskCompletion.deleteMany({ where: { userId: testUser.id, date: todayStr } });

      // Ensure active yesterday (yesterdayStr)
      await taskService.toggleTaskCompletion(testUser.id, recurringTask.id, yesterdayStr, true);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: todayStr,
        persist: false,
      });

      assert.strictEqual(res.currentStreak, 1, 'Streak from yesterday should be preserved');
      assert.strictEqual(res.isActiveToday, false, 'Not active today yet');
      assert.strictEqual(res.isAtRisk, true, 'Should be at risk within 24h grace period');
    });

    await test('24h+ inactivity -> streak resets to 0', async () => {
      // Clear today & yesterday completions, leaving only activity on threeDaysAgoStr
      await prisma.taskCompletion.deleteMany({ where: { userId: testUser.id } });
      await taskService.toggleTaskCompletion(testUser.id, recurringTask.id, threeDaysAgoStr, true);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: todayStr,
        persist: false,
      });

      assert.strictEqual(res.currentStreak, 0, 'Streak must reset to 0 after >24h inactivity');
      assert.strictEqual(res.longestStreak, 1, 'Historical peak streak should remain 1');
      assert.strictEqual(res.isActiveToday, false);
      assert.strictEqual(res.isAtRisk, false);
    });

    console.log('\n--- Section 3: StreakHistory Unbounded Growth Fix (Part 2.5) ---');

    await test('StreakHistory upsert idempotency: multiple toggles/recalculations do NOT duplicate rows', async () => {
      await prisma.streakHistory.deleteMany({ where: { userId: testUser.id } });

      // Calculate with persist: true 5 times on the same referenceDate
      await streakService.calculateUserStreak(testUser.id, { referenceDate: todayStr, persist: true });
      await streakService.calculateUserStreak(testUser.id, { referenceDate: todayStr, persist: true });
      await streakService.calculateUserStreak(testUser.id, { referenceDate: todayStr, persist: true });
      await streakService.calculateUserStreak(testUser.id, { referenceDate: todayStr, persist: true });
      await streakService.calculateUserStreak(testUser.id, { referenceDate: todayStr, persist: true });

      const historyRows = await prisma.streakHistory.findMany({
        where: { userId: testUser.id },
      });

      assert.strictEqual(historyRows.length, 1, 'Should have exactly 1 StreakHistory row for this date after multiple persists');
    });

    console.log('\n--- Section 4: Leaderboard Cache & Hourly Invalidation Fix (Part 2.1) ---');

    await test('Completing tasks does NOT bust leaderboard cache (preserves hourly TTL requirement)', async () => {
      // Warm cache
      const lbInitial = await leaderboardService.getLeaderboard('week', { bypassCache: true });
      assert.strictEqual(lbInitial.success, true);

      if (redis.isAvailable()) {
        // Read from cache to verify cached state
        const lbCachedBefore = await leaderboardService.getLeaderboard('week');
        assert.strictEqual(lbCachedBefore.source, 'cache');

        // Toggle task completion
        await taskService.toggleTaskCompletion(testUser.id, recurringTask.id, todayStr, true);

        // Read leaderboard again - MUST STILL BE FROM CACHE (not busted on toggle)
        const lbCachedAfter = await leaderboardService.getLeaderboard('week');
        assert.strictEqual(
          lbCachedAfter.source,
          'cache',
          'Leaderboard cache must remain intact after task completion; hourly scheduler refreshes it'
        );
      } else {
        console.log('    (Redis offline: DB fallback verified)');
        const lbDb = await leaderboardService.getLeaderboard('week');
        assert.strictEqual(lbDb.source, 'database');
      }
    });

    console.log('\n--- Section 5: Redis ZSET Dynamic Ranking & Offline Resilience (Part 2.3 & 3.4) ---');

    await test('getUserRankAndSurroundings returns valid rank and surrounding structure', async () => {
      const standing = await leaderboardService.getUserRankAndSurroundings(testUser.id, 'week', 2);
      assert.strictEqual(standing.success, true);
      assert(typeof standing.userRank === 'number');
      assert(typeof standing.userPoints === 'number');
      assert(typeof standing.userStreak === 'number');
      assert(Array.isArray(standing.surroundingUsers));
    });

    await test('UTC Week calculation consistency: getStartOfWeek matches Monday 00:00:00 UTC', async () => {
      const d = new Date('2026-08-25T14:30:00.000Z'); // Tuesday
      const start = leaderboardService.getStartOfWeek(d);
      assert.strictEqual(start.getUTCDay(), 1, 'Start of week must be Monday (1)');
      assert.strictEqual(start.getUTCHours(), 0);
      assert.strictEqual(start.getUTCMinutes(), 0);
      assert.strictEqual(start.getUTCSeconds(), 0);
    });

    console.log('\n--- Section 6: Security & Atomicity Audit Tests ---');

    await test('Security: User A cannot toggle or modify User B\'s task (must throw 404 Task not found)', async () => {
      // Create user B
      const userB = await prisma.user.create({
        data: {
          firebaseUid: `reg-uid-b-${Date.now()}`,
          email: `reg-user-b-${Date.now()}@byjus.com`,
          name: 'User B',
        },
      });

      try {
        let threw404 = false;
        try {
          // User B attempts to toggle User A's task
          await taskService.toggleTaskCompletion(userB.id, createdTask.id, todayStr, true);
        } catch (err) {
          if (err.statusCode === 404 && err.message.includes('Task not found')) {
            threw404 = true;
          }
        }
        assert.strictEqual(threw404, true, 'Must reject cross-user task modification with 404');
      } finally {
        await prisma.user.delete({ where: { id: userB.id } });
      }
    });

    await test('Historical week attribution: Completing historical task updates that historical week score', async () => {
      const historicalDate = '2026-07-15'; // A past week
      const histTask = await taskService.createTask(testUser.id, {
        title: 'Past Chemistry Quiz',
        category: 'Assessment',
        time: '2 PM',
        date: historicalDate,
        isRecurring: false,
      });

      const res = await taskService.toggleTaskCompletion(testUser.id, histTask.id, historicalDate, true);
      assert.strictEqual(res.completed, true);
      assert.strictEqual(res.pointsAwarded, 15);
      assert.strictEqual(res.pointsDelta, 15);

      // Verify WeeklyScore was created for that historical week
      const targetHistDate = new Date(`${historicalDate}T00:00:00.000Z`);
      const histWeekStart = leaderboardService.getStartOfWeek(targetHistDate);
      const score = await prisma.weeklyScore.findUnique({
        where: {
          userId_weekStartDate: {
            userId: testUser.id,
            weekStartDate: histWeekStart,
          },
        },
      });
      assert(score !== null, 'WeeklyScore must be attributed to the historical week');
      assert(score.points >= 15);
    });

    await test('Calendar range service: getTasksCalendarRange aggregates tasks across date span', async () => {
      const range = await taskService.getTasksCalendarRange(testUser.id, '2026-08-20', '2026-08-26');
      assert(range && typeof range === 'object');
      assert(Array.isArray(range['2026-08-25']));
      assert(range['2026-08-25'].some((t) => t.id === recurringTask.id));
    });

    await test('Task recurrence update: switching to recurring clears specific date', async () => {
      const oneTimeTask = await taskService.createTask(testUser.id, {
        title: 'Temp Task',
        date: '2026-08-30',
        isRecurring: false,
      });

      const updated = await taskService.updateTask(testUser.id, oneTimeTask.id, {
        isRecurring: true,
        recurringType: 'weekdays',
      });

      assert.strictEqual(updated.isRecurring, true);
      assert.strictEqual(updated.date, null, 'Switching to recurring must set date to null');
    });

  } finally {
    // Cleanup
    if (testUser) {
      await prisma.taskCompletion.deleteMany({ where: { userId: testUser.id } });
      await prisma.activity.deleteMany({ where: { userId: testUser.id } });
      await prisma.weeklyScore.deleteMany({ where: { userId: testUser.id } });
      await prisma.streakHistory.deleteMany({ where: { userId: testUser.id } });
      await prisma.task.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    await redis.disconnect();
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`  REGRESSION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTestSuite();
