const prisma = require('../src/config/prisma');

async function seedUserData() {
  console.log('--- Starting Database Reset & Test User Seed ---');

  try {
    // 1. Clear existing test data
    await prisma.taskCompletion.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.weeklyScore.deleteMany({});
    await prisma.streakHistory.deleteMany({});
    await prisma.leaderboardCache.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('✓ Cleaned up existing database records.');

    // 2. Create Primary Test User (Damir / Aarav)
    const mainUser = await prisma.user.create({
      data: {
        firebaseUid: 'test-user-damir',
        email: 'damir@byjus.com',
        name: 'Damir',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✓ Created primary user: ${mainUser.name} (${mainUser.email})`);

    // 3. Create Streak History for Main User (15-day streak)
    const streakEntries = [];
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      streakEntries.push({
        userId: mainUser.id,
        date: date,
        streakCount: 15 - i,
        frozen: false
      });
    }

    for (const entry of streakEntries) {
      await prisma.streakHistory.create({ data: entry });
    }
    console.log('✓ Seeded 15-day streak history.');

    // 4. Create Weekly Scores
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    await prisma.weeklyScore.create({
      data: {
        userId: mainUser.id,
        weekStartDate: weekStart,
        score: 290
      }
    });
    console.log('✓ Seeded weekly score: 290 pts.');

    // 5. Create Activity History for Main User
    const activities = [
      { activityType: 'lesson', points: 30, metadata: JSON.stringify({ title: 'Mathematics: Calculus & Limits' }) },
      { activityType: 'quiz', points: 25, metadata: JSON.stringify({ title: 'Physics Speed Quiz: Mechanics' }) },
      { activityType: 'assignment', points: 20, metadata: JSON.stringify({ title: 'Chemistry Lab Assignment' }) },
      { activityType: 'lesson', points: 30, metadata: JSON.stringify({ title: 'Biology: Genetics & DNA' }) },
    ];

    for (const act of activities) {
      await prisma.activity.create({
        data: {
          userId: mainUser.id,
          activityType: act.activityType,
          points: act.points,
          metadata: act.metadata,
          timestamp: new Date()
        }
      });
    }
    console.log('✓ Seeded recent learning activities.');

    // 6. Create Cohort Leaderboard Peers
    const cohortMembers = [
      { name: 'Areeq S.', email: 'areeq@byjus.com', score: 520, rank: 1, streak: 28 },
      { name: 'Rhea M.', email: 'rhea@byjus.com', score: 410, rank: 2, streak: 21 },
      { name: 'Zoya K.', email: 'zoya@byjus.com', score: 365, rank: 3, streak: 19 },
      { name: 'Meera Nair', email: 'meera@byjus.com', score: 330, rank: 4, streak: 16 },
      { name: 'Ishaan Verma', email: 'ishaan@byjus.com', score: 312, rank: 5, streak: 14 },
      { name: 'Priya Iyer', email: 'priya@byjus.com', score: 301, rank: 6, streak: 12 },
      { name: 'David Charles', email: 'david@byjus.com', score: 295, rank: 7, streak: 10 },
    ];

    for (const peer of cohortMembers) {
      const peerUser = await prisma.user.create({
        data: {
          firebaseUid: `peer-${peer.rank}`,
          email: peer.email,
          name: peer.name
        }
      });

      await prisma.weeklyScore.create({
        data: {
          userId: peerUser.id,
          weekStartDate: weekStart,
          score: peer.score
        }
      });

      await prisma.streakHistory.create({
        data: {
          userId: peerUser.id,
          date: now,
          streakCount: peer.streak
        }
      });

      await prisma.leaderboardCache.create({
        data: {
          category: 'global',
          rank: peer.rank,
          userId: peerUser.id,
          score: peer.score
        }
      });
    }

    // Add main user to leaderboard cache at #14
    await prisma.leaderboardCache.create({
      data: {
        category: 'global',
        rank: 14,
        userId: mainUser.id,
        score: 290
      }
    });

    console.log('✓ Seeded cohort leaderboard rankings (#1 through #14).');
    console.log('\n✅ Database successfully seeded with test user data!');
  } catch (error) {
    console.error('✗ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedUserData();
