const assert = require('assert');
const prisma = require('../src/config/prisma');
const redis = require('../src/config/redis');
const streakService = require('../src/services/streak.service');
const taskService = require('../src/services/task.service');

async function runStreakEngineTests() {
  console.log('====================================================');
  console.log('  RUNNING COMPREHENSIVE STREAK ENGINE TEST SUITE   ');
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

  // Pure Algorithm Unit Tests
  console.log('--- Phase 1: Pure Streak Algorithm Unit Tests ---');

  await test('User has no activity -> currentStreak = 0, longestStreak = 0, isActiveToday = false', async () => {
    const res = streakService.calculateStreakFromActiveDates([], '2024-12-09');
    assert.strictEqual(res.currentStreak, 0);
    assert.strictEqual(res.longestStreak, 0);
    assert.strictEqual(res.isActiveToday, false);
    assert.strictEqual(res.isAtRisk, false);
    assert.strictEqual(res.totalActiveDays, 0);
  });

  await test('Activity today only -> currentStreak = 1, longestStreak = 1, isActiveToday = true', async () => {
    const res = streakService.calculateStreakFromActiveDates(['2024-12-09'], '2024-12-09');
    assert.strictEqual(res.currentStreak, 1);
    assert.strictEqual(res.longestStreak, 1);
    assert.strictEqual(res.isActiveToday, true);
    assert.strictEqual(res.isAtRisk, false);
  });

  await test('Activity today + yesterday -> currentStreak = 2, longestStreak = 2', async () => {
    const res = streakService.calculateStreakFromActiveDates(['2024-12-08', '2024-12-09'], '2024-12-09');
    assert.strictEqual(res.currentStreak, 2);
    assert.strictEqual(res.longestStreak, 2);
    assert.strictEqual(res.isActiveToday, true);
  });

  await test('Activity for 7 consecutive days -> currentStreak = 7, longestStreak = 7', async () => {
    const dates = [
      '2024-12-03',
      '2024-12-04',
      '2024-12-05',
      '2024-12-06',
      '2024-12-07',
      '2024-12-08',
      '2024-12-09',
    ];
    const res = streakService.calculateStreakFromActiveDates(dates, '2024-12-09');
    assert.strictEqual(res.currentStreak, 7);
    assert.strictEqual(res.longestStreak, 7);
    assert.strictEqual(res.isActiveToday, true);
  });

  await test('Multiple activities on same day -> duplicate dates do not artificially inflate streak', async () => {
    // 5 activities on 2024-12-09, 3 activities on 2024-12-08
    const datesWithDuplicates = [
      '2024-12-08',
      '2024-12-08',
      '2024-12-08',
      '2024-12-09',
      '2024-12-09',
      '2024-12-09',
      '2024-12-09',
      '2024-12-09',
    ];
    const res = streakService.calculateStreakFromActiveDates(datesWithDuplicates, '2024-12-09');
    assert.strictEqual(res.currentStreak, 2);
    assert.strictEqual(res.longestStreak, 2);
    assert.strictEqual(res.totalActiveDays, 2);
  });

  await test('24-hour grace period: active yesterday, pending today -> currentStreak retained, isAtRisk = true', async () => {
    // User was active Dec 7 and Dec 8. Today is Dec 9, user has not yet completed tasks today.
    const dates = ['2024-12-07', '2024-12-08'];
    const res = streakService.calculateStreakFromActiveDates(dates, '2024-12-09');
    assert.strictEqual(res.currentStreak, 2);
    assert.strictEqual(res.isActiveToday, false);
    assert.strictEqual(res.isAtRisk, true);
  });

  await test('Missed day (24h+ inactivity) -> streak resets to 0', async () => {
    // User was active Dec 5, 6, 7. Missed Dec 8. Today is Dec 9.
    const dates = ['2024-12-05', '2024-12-06', '2024-12-07'];
    const res = streakService.calculateStreakFromActiveDates(dates, '2024-12-09');
    assert.strictEqual(res.currentStreak, 0);
    assert.strictEqual(res.longestStreak, 3); // Historical peak preserved
    assert.strictEqual(res.isActiveToday, false);
    assert.strictEqual(res.isAtRisk, false);
  });

  await test('Resuming activity after a break -> currentStreak = 1, historical longestStreak preserved', async () => {
    // Old 5-day streak in November, then gap, now active today
    const dates = [
      '2024-11-01',
      '2024-11-02',
      '2024-11-03',
      '2024-11-04',
      '2024-11-05',
      '2024-12-09', // today
    ];
    const res = streakService.calculateStreakFromActiveDates(dates, '2024-12-09');
    assert.strictEqual(res.currentStreak, 1);
    assert.strictEqual(res.longestStreak, 5);
    assert.strictEqual(res.isActiveToday, true);
  });

  await test('Longest streak across multiple separated streaks evaluates highest peak', async () => {
    const dates = [
      '2024-10-01', '2024-10-02', '2024-10-03', // 3 days
      '2024-11-10', '2024-11-11', '2024-11-12', '2024-11-13', '2024-11-14', '2024-11-15', // 6 days (peak)
      '2024-12-08', '2024-12-09', // 2 days (current)
    ];
    const res = streakService.calculateStreakFromActiveDates(dates, '2024-12-09');
    assert.strictEqual(res.currentStreak, 2);
    assert.strictEqual(res.longestStreak, 6);
  });

  await test('Date helper functions handle month and year boundaries correctly', async () => {
    assert.strictEqual(streakService.shiftDateDays('2024-12-31', 1), '2025-01-01');
    assert.strictEqual(streakService.shiftDateDays('2025-01-01', -1), '2024-12-31');
    assert.strictEqual(streakService.shiftDateDays('2024-02-28', 1), '2024-02-29'); // Leap year
    assert.strictEqual(streakService.shiftDateDays('2024-02-29', 1), '2024-03-01');
    assert.strictEqual(streakService.getDaysDifference('2024-12-01', '2024-12-05'), 4);
    assert.strictEqual(streakService.getDaysDifference('2024-12-05', '2024-12-01'), -4);
  });

  // Database-Driven Integration Tests
  console.log('\n--- Phase 2: Live Database & Integration Tests ---');

  let testUser;
  try {
    // 1. Setup test user
    testUser = await prisma.user.findFirst({
      where: { email: 'streak-tester@byjus.com' },
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          firebaseUid: 'streak-tester-uid',
          email: 'streak-tester@byjus.com',
          name: 'Streak Tester',
        },
      });
    }

    // Clean any prior test completions and activities for this user
    await prisma.taskCompletion.deleteMany({ where: { userId: testUser.id } });
    await prisma.activity.deleteMany({ where: { userId: testUser.id } });
    await prisma.streakHistory.deleteMany({ where: { userId: testUser.id } });

    // Ensure 2 test tasks exist
    let task1 = await prisma.task.findFirst({ where: { userId: testUser.id, title: 'Streak Task 1' } });
    if (!task1) {
      task1 = await taskService.createTask(testUser.id, {
        title: 'Streak Task 1',
        isRecurring: true,
        recurringType: 'daily',
      });
    }

    let task2 = await prisma.task.findFirst({ where: { userId: testUser.id, title: 'Streak Task 2' } });
    if (!task2) {
      task2 = await taskService.createTask(testUser.id, {
        title: 'Streak Task 2',
        isRecurring: true,
        recurringType: 'daily',
      });
    }

    await test('Database: Fresh user has 0 streak', async () => {
      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 0);
      assert.strictEqual(res.longestStreak, 0);
      assert.strictEqual(res.isActiveToday, false);
    });

    await test('Database: Completing 1 task today -> streak = 1', async () => {
      await taskService.toggleTaskCompletion(testUser.id, task1.id, '2024-12-09', true);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 1);
      assert.strictEqual(res.longestStreak, 1);
      assert.strictEqual(res.isActiveToday, true);
    });

    await test('Database: Completing 2nd task on SAME DAY -> streak stays 1 (no double increment)', async () => {
      await taskService.toggleTaskCompletion(testUser.id, task2.id, '2024-12-09', true);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 1);
      assert.strictEqual(res.longestStreak, 1);
    });

    await test('Database: Re-toggling same task completion with same status -> no duplicate points awarded', async () => {
      // task2 is already true from previous test. Marking it true again should yield 0 pointsAwarded.
      const result = await taskService.toggleTaskCompletion(testUser.id, task2.id, '2024-12-09', true);
      assert.strictEqual(result.pointsAwarded, 0); // Already completed, 0 additional points

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 1);
    });

    await test('Database: Completing task for yesterday -> streak becomes 2', async () => {
      await taskService.toggleTaskCompletion(testUser.id, task1.id, '2024-12-08', true);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 2);
      assert.strictEqual(res.longestStreak, 2);
    });

    await test('Database: Completing tasks for 5 consecutive days -> streak = 5', async () => {
      await taskService.toggleTaskCompletion(testUser.id, task1.id, '2024-12-05', true);
      await taskService.toggleTaskCompletion(testUser.id, task1.id, '2024-12-06', true);
      await taskService.toggleTaskCompletion(testUser.id, task1.id, '2024-12-07', true);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 5);
      assert.strictEqual(res.longestStreak, 5);
    });

    await test('Database: Uncompleting Dec 07 (creates gap) -> today streak resets to 2 (Dec 8+9)', async () => {
      await taskService.toggleTaskCompletion(testUser.id, task1.id, '2024-12-07', false);

      const res = await streakService.calculateUserStreak(testUser.id, {
        referenceDate: '2024-12-09',
        persist: false,
      });
      assert.strictEqual(res.currentStreak, 2); // Dec 8 and Dec 9
      assert.strictEqual(res.longestStreak, 2); // Previous peak is now 2 (Dec 5-6 or Dec 8-9)
    });

    await test('Database: Streak history weekly calendar view contains 7 days with correct statuses', async () => {
      const history = await streakService.getUserStreakHistory(testUser.id, {
        referenceDate: '2024-12-09',
      });
      assert(Array.isArray(history.weekCalendar));
      assert.strictEqual(history.weekCalendar.length, 7);
      
      const mon = history.weekCalendar.find((d) => d.date === '2024-12-09');
      assert(mon);
      assert.strictEqual(mon.completed, true);
      assert.strictEqual(mon.isToday, true);
    });

  } finally {
    // Cleanup test data
    if (testUser) {
      await prisma.taskCompletion.deleteMany({ where: { userId: testUser.id } });
      await prisma.activity.deleteMany({ where: { userId: testUser.id } });
      await prisma.streakHistory.deleteMany({ where: { userId: testUser.id } });
    }
    await redis.disconnect();
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`  STREAK ENGINE TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runStreakEngineTests();
