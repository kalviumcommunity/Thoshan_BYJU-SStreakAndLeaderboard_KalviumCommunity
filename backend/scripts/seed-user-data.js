const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');
const redis = require('../src/config/redis');
const leaderboardService = require('../src/services/leaderboard.service');

const DEMO_USERS = [
  // Top Users (900–1500 pts, 25–60 day streaks)
  { name: 'Zayn Merchant', email: 'zayn.merchant@demo.example.com', targetPoints: 1420, targetStreak: 54, daysActive: 58 },
  { name: 'Aisha Contractor', email: 'aisha.contractor@demo.example.com', targetPoints: 1290, targetStreak: 48, daysActive: 52 },
  { name: 'Ritvik Mistry', email: 'ritvik.mistry@demo.example.com', targetPoints: 1180, targetStreak: 42, daysActive: 46 },
  { name: 'Nivaan Kapadia', email: 'nivaan.kapadia@demo.example.com', targetPoints: 1060, targetStreak: 36, daysActive: 40 },
  { name: 'Misha Saldanha', email: 'misha.saldanha@demo.example.com', targetPoints: 980, targetStreak: 32, daysActive: 36 },
  { name: 'Aariz Bhasin', email: 'aariz.bhasin@demo.example.com', targetPoints: 915, targetStreak: 29, daysActive: 33 },

  // Upper-Middle Users (600–900 pts, 15–35 day streaks)
  { name: 'Tia Fernandes', email: 'tia.fernandes@demo.example.com', targetPoints: 865, targetStreak: 26, daysActive: 30 },
  { name: 'Reyansh Dalal', email: 'reyansh.dalal@demo.example.com', targetPoints: 810, targetStreak: 24, daysActive: 28 },
  { name: 'Kavya Vora', email: 'kavya.vora@demo.example.com', targetPoints: 770, targetStreak: 22, daysActive: 26 },
  { name: 'Ahaan Kothari', email: 'ahaan.kothari@demo.example.com', targetPoints: 735, targetStreak: 20, daysActive: 24 },
  { name: 'Rhea D\'Souza', email: 'rhea.dsouza@demo.example.com', targetPoints: 690, targetStreak: 19, daysActive: 22 },
  { name: 'Yuvan Shetty', email: 'yuvan.shetty@demo.example.com', targetPoints: 660, targetStreak: 17, daysActive: 21 },
  { name: 'Nyla Merchant', email: 'nyla.merchant@demo.example.com', targetPoints: 630, targetStreak: 16, daysActive: 20 },
  { name: 'Kian Batra', email: 'kian.batra@demo.example.com', targetPoints: 605, targetStreak: 15, daysActive: 19 },

  // Middle Users (300–600 pts, 7–20 day streaks)
  { name: 'Aarav Contractor', email: 'aarav.contractor@demo.example.com', targetPoints: 580, targetStreak: 14, daysActive: 18 },
  { name: 'Mihir Doshi', email: 'mihir.doshi@demo.example.com', targetPoints: 540, targetStreak: 13, daysActive: 17 },
  { name: 'Sia Wadhwa', email: 'sia.wadhwa@demo.example.com', targetPoints: 505, targetStreak: 12, daysActive: 16 },
  { name: 'Veer Saldanha', email: 'veer.saldanha@demo.example.com', targetPoints: 470, targetStreak: 11, daysActive: 15 },
  { name: 'Anaya Mirza', email: 'anaya.mirza@demo.example.com', targetPoints: 440, targetStreak: 10, daysActive: 14 },
  { name: 'Rian Kapadia', email: 'rian.kapadia@demo.example.com', targetPoints: 410, targetStreak: 9, daysActive: 13 },
  { name: 'Zoya Sequeira', email: 'zoya.sequeira@demo.example.com', targetPoints: 380, targetStreak: 9, daysActive: 12 },
  { name: 'Advik Vora', email: 'advik.vora@demo.example.com', targetPoints: 350, targetStreak: 8, daysActive: 11 },
  { name: 'Tara Bhasin', email: 'tara.bhasin@demo.example.com', targetPoints: 330, targetStreak: 7, daysActive: 10 },
  { name: 'Vihaan Kothari', email: 'vihaan.kothari@demo.example.com', targetPoints: 310, targetStreak: 7, daysActive: 10 },

  // Lower Users (50–300 pts, 1–10 day streaks)
  { name: 'Meher Dalal', email: 'meher.dalal@demo.example.com', targetPoints: 270, targetStreak: 6, daysActive: 8 },
  { name: 'Arin Fernandes', email: 'arin.fernandes@demo.example.com', targetPoints: 220, targetStreak: 5, daysActive: 7 },
  { name: 'Inaya Mistry', email: 'inaya.mistry@demo.example.com', targetPoints: 175, targetStreak: 4, daysActive: 6 },
  { name: 'Rishaan Merchant', email: 'rishaan.merchant@demo.example.com', targetPoints: 130, targetStreak: 3, daysActive: 4 },
  { name: 'Alina D\'Souza', email: 'alina.dsouza@demo.example.com', targetPoints: 95, targetStreak: 2, daysActive: 3 },
  { name: 'Ved Kapadia', email: 'ved.kapadia@demo.example.com', targetPoints: 60, targetStreak: 1, daysActive: 2 },
];

const CURRICULUM_TASKS = [
  { title: 'Calculus: Derivatives & Limits Drill', category: 'Mathematics', time: '09:00 AM' },
  { title: 'Physics: Newton\'s Laws & Mechanics Quiz', category: 'Physics', time: '11:00 AM' },
  { title: 'Chemistry: Chemical Bonding & Periodic Trends', category: 'Chemistry', time: '02:00 PM' },
  { title: 'Biology: Genetics & Cellular Reproduction', category: 'Biology', time: '04:30 PM' },
  { title: 'Daily Speed Arithmetic & Problem Solving', category: 'Mental Math', time: '07:00 PM' },
];

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function seedRealisticDemoData() {
  console.log('====================================================');
  console.log('  BYJU\'S LEADERBOARD SEED — REALISTIC DEMO USERS   ');
  console.log('====================================================\n');

  const defaultPasswordHash = await bcrypt.hash('DemoPass@123', 10);
  const now = new Date();
  let totalTasksCreated = 0;
  let totalCompletionsCreated = 0;
  let totalActivitiesCreated = 0;

  try {
    // 1. Process each demo user idempotently
    for (let userIdx = 0; userIdx < DEMO_USERS.length; userIdx++) {
      const demo = DEMO_USERS[userIdx];
      const userCreationDate = new Date(now.getTime() - (demo.daysActive + 10) * 86400000);

      // Upsert demo user without touching non-demo accounts
      const user = await prisma.user.upsert({
        where: { email: demo.email },
        update: {
          name: demo.name,
          updatedAt: new Date(),
        },
        create: {
          email: demo.email,
          name: demo.name,
          passwordHash: defaultPasswordHash,
          firebaseUid: `uid-${demo.email}`,
          createdAt: userCreationDate,
          updatedAt: new Date(),
        },
      });

      // Clear existing demo-specific activity records for idempotency
      await prisma.taskCompletion.deleteMany({ where: { userId: user.id } });
      await prisma.activity.deleteMany({ where: { userId: user.id } });
      await prisma.weeklyScore.deleteMany({ where: { userId: user.id } });
      await prisma.streakHistory.deleteMany({ where: { userId: user.id } });

      // Upsert standard recurring curriculum tasks for user
      const createdTasks = [];
      for (const t of CURRICULUM_TASKS) {
        let task = await prisma.task.findFirst({
          where: { userId: user.id, title: t.title },
        });

        if (!task) {
          task = await prisma.task.create({
            data: {
              userId: user.id,
              title: t.title,
              category: t.category,
              time: t.time,
              isRecurring: true,
              recurringType: 'daily',
              recurringDays: '0,1,2,3,4,5,6',
              createdAt: userCreationDate,
            },
          });
          totalTasksCreated++;
        }
        createdTasks.push(task);
      }

      // Generate activity and completions across history
      const weeklyScoreMap = new Map(); // weekStartTime (ms) -> score

      let accumulatedPoints = 0;
      const targetPts = demo.targetPoints;

      // Seed consecutive days for the target streak ending today
      for (let dayOffset = demo.daysActive - 1; dayOffset >= 0; dayOffset--) {
        const activityDate = new Date(now.getTime() - dayOffset * 86400000);
        const dateStr = formatDate(activityDate);
        const isWithinStreakWindow = dayOffset < demo.targetStreak;

        // Skip some days outside streak window to create realistic gaps
        if (!isWithinStreakWindow && dayOffset % 3 === 0) {
          continue;
        }

        // Complete 1 to 3 tasks on this day
        const tasksToComplete = isWithinStreakWindow ? (dayOffset % 2 === 0 ? 2 : 1) : 1;

        for (let tIdx = 0; tIdx < Math.min(tasksToComplete, createdTasks.length); tIdx++) {
          const task = createdTasks[tIdx];
          const completionTimestamp = new Date(activityDate);
          completionTimestamp.setUTCHours(9 + tIdx * 3, (userIdx * 7) % 60, 0, 0);

          // 1. Task Completion Record
          await prisma.taskCompletion.create({
            data: {
              userId: user.id,
              taskId: task.id,
              date: dateStr,
              completed: true,
              completedAt: completionTimestamp,
            },
          });
          totalCompletionsCreated++;

          // 2. Activity Record (+15 pts)
          const pts = 15;
          await prisma.activity.create({
            data: {
              userId: user.id,
              activityType: 'task_completion',
              points: pts,
              metadata: JSON.stringify({ taskId: task.id, title: task.title, date: dateStr }),
              timestamp: completionTimestamp,
            },
          });
          totalActivitiesCreated++;
          accumulatedPoints += pts;

          // Track weekly score
          const weekStart = leaderboardService.getStartOfWeek(completionTimestamp);
          const currentWeekScore = weeklyScoreMap.get(weekStart.getTime()) || 0;
          weeklyScoreMap.set(weekStart.getTime(), currentWeekScore + pts);
        }

        // Add periodic bonus learning activity (quiz / concept mastery) to reach target points
        if (accumulatedPoints < targetPts && (dayOffset % 4 === 0 || dayOffset === 0)) {
          const bonusPts = Math.min(25, targetPts - accumulatedPoints);
          if (bonusPts > 0) {
            const bonusTimestamp = new Date(activityDate);
            bonusTimestamp.setUTCHours(18, (userIdx * 11) % 60, 0, 0);

            await prisma.activity.create({
              data: {
                userId: user.id,
                activityType: 'quiz_mastery',
                points: bonusPts,
                metadata: JSON.stringify({ topic: 'STEM Advanced Concept Mastery', scorePercentage: 95 }),
                timestamp: bonusTimestamp,
              },
            });
            totalActivitiesCreated++;
            accumulatedPoints += bonusPts;

            const weekStart = leaderboardService.getStartOfWeek(bonusTimestamp);
            const currentWeekScore = weeklyScoreMap.get(weekStart.getTime()) || 0;
            weeklyScoreMap.set(weekStart.getTime(), currentWeekScore + bonusPts);
          }
        }
      }

      // Upsert Weekly Score records
      for (const [weekTimeMs, score] of weeklyScoreMap.entries()) {
        const weekStartDate = new Date(weekTimeMs);
        await prisma.weeklyScore.upsert({
          where: {
            userId_weekStartDate: {
              userId: user.id,
              weekStartDate,
            },
          },
          update: { score },
          create: {
            userId: user.id,
            weekStartDate,
            score,
          },
        });
      }

      // Seed Streak History records leading up to today
      for (let s = demo.targetStreak; s >= 1; s--) {
        const streakDate = new Date(now.getTime() - (demo.targetStreak - s) * 86400000);
        streakDate.setUTCHours(0, 0, 0, 0);

        await prisma.streakHistory.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: streakDate,
            },
          },
          update: {
            streakCount: s,
            frozen: false,
          },
          create: {
            userId: user.id,
            date: streakDate,
            streakCount: s,
            frozen: false,
          },
        });
      }

      console.log(`  ✓ Seeded demo user: ${demo.name.padEnd(20)} [Pts: ~${accumulatedPoints}, Streak: ${demo.targetStreak}d]`);
    }

    console.log('\n--- Refreshing Application Leaderboards & Redis Caches ---');

    // 2. Re-compute real leaderboard rankings via application service and warm Redis cache
    await leaderboardService.refreshAllLeaderboards();

    // 3. Query the authoritative leaderboard to verify final rankings
    const weeklyLeaderboard = await leaderboardService.getLeaderboard('week');
    const allTimeLeaderboard = await leaderboardService.getLeaderboard('all_time');

    console.log('\n====================================================');
    console.log('  TOP 10 LEADERBOARD STANDINGS (ALL-TIME)');
    console.log('====================================================');
    console.log('Rank | Name                 | Points | Streak | Status');
    console.log('-----+----------------------+--------+--------+-------');

    const top10 = (allTimeLeaderboard.allRanks || []).slice(0, 10);
    for (const item of top10) {
      const rankStr = String(item.rank).padStart(4);
      const nameStr = item.name.padEnd(20);
      const ptsStr = String(item.points).padStart(6);
      const streakStr = `${item.streak}d`.padStart(6);
      console.log(`${rankStr} | ${nameStr} | ${ptsStr} | ${streakStr} | ${item.status}`);
    }

    console.log('----------------------------------------------------\n');
    console.log(`✅ Demo Seeding Finished Successfully!`);
    console.log(`   Demo Users Created/Updated: ${DEMO_USERS.length}`);
    console.log(`   Tasks Created/Verified:     ${totalTasksCreated}`);
    console.log(`   Completions Generated:      ${totalCompletionsCreated}`);
    console.log(`   Activities Generated:       ${totalActivitiesCreated}`);
    console.log(`   Weekly Total Learners:      ${weeklyLeaderboard.totalLearners}`);
    console.log(`   All-Time Total Learners:    ${allTimeLeaderboard.totalLearners}`);

  } catch (err) {
    console.error('✗ Seed Error:', err);
    process.exit(1);
  } finally {
    await redis.disconnect();
    await prisma.$disconnect();
  }
}

seedRealisticDemoData();
