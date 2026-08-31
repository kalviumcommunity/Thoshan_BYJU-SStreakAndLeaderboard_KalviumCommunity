const prisma = require('../config/prisma');
const redis = require('../config/redis');
const streakService = require('./streak.service');

const CACHE_TTL_SECONDS = 3600; // 1 hour TTL for leaderboard cache

/**
 * Helper to get the start of the week (Monday 00:00:00 UTC).
 * @param {Date} [date]
 * @returns {Date}
 */
function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Helper to get the start of the month (1st day 00:00:00 UTC).
 * @param {Date} [date]
 * @returns {Date}
 */
function getStartOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Helper to get the start of today (00:00:00 UTC).
 * @param {Date} [date]
 * @returns {Date}
 */
function getStartOfDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Format timeframe label for presentation.
 * @param {string} timeframe - 'day' | 'week' | 'month' | 'all_time'
 * @returns {string}
 */
function getTimeframeLabel(timeframe) {
  const now = new Date();
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  switch (timeframe) {
    case 'day':
      return `Today, ${now.getUTCDate()} ${MONTHS_SHORT[now.getUTCMonth()]}`;
    case 'month':
      return `${MONTHS_SHORT[now.getUTCMonth()]} ${now.getUTCFullYear()} Total`;
    case 'week':
    default: {
      const start = getStartOfWeek(now);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return `${start.getUTCDate()}-${end.getUTCDate()} ${MONTHS_SHORT[start.getUTCMonth()]} Cohort`;
    }
  }
}

// Curated cohort mock learners to display active competition in the leaderboard
const MOCK_COHORT_LEARNERS = [
  { id: 'mock-user-01', name: 'Aarav Sharma', email: 'aarav.sharma@byjus.com', streak: 14, scores: { day: 45, week: 280, month: 850, all_time: 3400 }, createdAt: new Date('2024-01-10T08:00:00Z') },
  { id: 'mock-user-02', name: 'Ananya Iyer', email: 'ananya.iyer@byjus.com', streak: 12, scores: { day: 40, week: 250, month: 780, all_time: 3150 }, createdAt: new Date('2024-01-12T08:00:00Z') },
  { id: 'mock-user-03', name: 'Rohan Verma', email: 'rohan.verma@byjus.com', streak: 10, scores: { day: 35, week: 220, month: 710, all_time: 2900 }, createdAt: new Date('2024-01-15T08:00:00Z') },
  { id: 'mock-user-04', name: 'Priya Nair', email: 'priya.nair@byjus.com', streak: 9, scores: { day: 30, week: 190, month: 640, all_time: 2600 }, createdAt: new Date('2024-01-18T08:00:00Z') },
  { id: 'mock-user-05', name: 'Vikram Patel', email: 'vikram.patel@byjus.com', streak: 8, scores: { day: 25, week: 160, month: 580, all_time: 2350 }, createdAt: new Date('2024-01-20T08:00:00Z') },
  { id: 'mock-user-06', name: 'Sneha Reddy', email: 'sneha.reddy@byjus.com', streak: 7, scores: { day: 20, week: 140, month: 510, all_time: 2100 }, createdAt: new Date('2024-01-22T08:00:00Z') },
  { id: 'mock-user-07', name: 'Rahul Mehta', email: 'rahul.mehta@byjus.com', streak: 6, scores: { day: 20, week: 120, month: 460, all_time: 1950 }, createdAt: new Date('2024-01-25T08:00:00Z') },
  { id: 'mock-user-08', name: 'Divya Sen', email: 'divya.sen@byjus.com', streak: 5, scores: { day: 15, week: 100, month: 400, all_time: 1750 }, createdAt: new Date('2024-01-28T08:00:00Z') },
  { id: 'mock-user-09', name: 'Arjun Gupta', email: 'arjun.gupta@byjus.com', streak: 5, scores: { day: 15, week: 90, month: 350, all_time: 1500 }, createdAt: new Date('2024-02-01T08:00:00Z') },
  { id: 'mock-user-10', name: 'Neha Joshi', email: 'neha.joshi@byjus.com', streak: 4, scores: { day: 10, week: 75, month: 300, all_time: 1300 }, createdAt: new Date('2024-02-05T08:00:00Z') },
  { id: 'mock-user-11', name: 'Siddharth Rao', email: 'siddharth.rao@byjus.com', streak: 4, scores: { day: 10, week: 60, month: 250, all_time: 1150 }, createdAt: new Date('2024-02-10T08:00:00Z') },
  { id: 'mock-user-12', name: 'Pooja Hegde', email: 'pooja.hegde@byjus.com', streak: 3, scores: { day: 5, week: 50, month: 210, all_time: 980 }, createdAt: new Date('2024-02-15T08:00:00Z') },
  { id: 'mock-user-13', name: 'Karan Malhotra', email: 'karan.malhotra@byjus.com', streak: 3, scores: { day: 5, week: 40, month: 170, all_time: 820 }, createdAt: new Date('2024-02-18T08:00:00Z') },
  { id: 'mock-user-14', name: 'Riya Kapoor', email: 'riya.kapoor@byjus.com', streak: 2, scores: { day: 5, week: 30, month: 140, all_time: 690 }, createdAt: new Date('2024-02-20T08:00:00Z') },
  { id: 'mock-user-15', name: 'Aditya Kumar', email: 'aditya.kumar@byjus.com', streak: 2, scores: { day: 0, week: 20, month: 110, all_time: 540 }, createdAt: new Date('2024-02-22T08:00:00Z') },
  { id: 'mock-user-16', name: 'Ishaan Das', email: 'ishaan.das@byjus.com', streak: 1, scores: { day: 0, week: 15, month: 80, all_time: 420 }, createdAt: new Date('2024-02-25T08:00:00Z') },
  { id: 'mock-user-17', name: 'Tanvi Bhat', email: 'tanvi.bhat@byjus.com', streak: 1, scores: { day: 0, week: 10, month: 60, all_time: 310 }, createdAt: new Date('2024-02-28T08:00:00Z') },
  { id: 'mock-user-18', name: 'Kabir Singh', email: 'kabir.singh@byjus.com', streak: 1, scores: { day: 0, week: 10, month: 40, all_time: 220 }, createdAt: new Date('2024-03-01T08:00:00Z') },
  { id: 'mock-user-19', name: 'Meera Nambiar', email: 'meera.nambiar@byjus.com', streak: 1, scores: { day: 0, week: 5, month: 30, all_time: 150 }, createdAt: new Date('2024-03-03T08:00:00Z') },
  { id: 'mock-user-20', name: 'Yash Choudhary', email: 'yash.choudhary@byjus.com', streak: 0, scores: { day: 0, week: 0, month: 15, all_time: 90 }, createdAt: new Date('2024-03-05T08:00:00Z') },
];

/**
 * Compute raw leaderboard scores and rankings from database across all users.
 * @param {string} timeframe - 'day' | 'week' | 'month' | 'all_time'
 * @returns {Promise<Array>} Ranked user list
 */
async function computeLeaderboardFromDatabase(timeframe = 'week') {
  let users = [];
  try {
    users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  } catch (err) {
    console.warn('[Leaderboard] Could not query database users:', err.message);
  }

  const now = new Date();
  let timeFilter = null;

  if (timeframe === 'day') {
    timeFilter = getStartOfDay(now);
  } else if (timeframe === 'week') {
    timeFilter = getStartOfWeek(now);
  } else if (timeframe === 'month') {
    timeFilter = getStartOfMonth(now);
  }

  // 1. Fetch activities matching timeframe
  const scoreMap = new Map();
  try {
    const activities = await prisma.activity.findMany({
      where: timeFilter
        ? {
            timestamp: { gte: timeFilter },
            points: { gt: 0 },
          }
        : {
            points: { gt: 0 },
          },
      select: {
        userId: true,
        points: true,
      },
    });

    for (const act of activities) {
      const current = scoreMap.get(act.userId) || 0;
      scoreMap.set(act.userId, current + act.points);
    }

    // If weekly, also check weekly_scores table to merge any seeded or batch scores
    if (timeframe === 'week') {
      const weekStart = getStartOfWeek(now);
      const weeklyScores = await prisma.weeklyScore.findMany({
        where: { weekStartDate: weekStart },
        select: { userId: true, score: true },
      });

      for (const ws of weeklyScores) {
        const existing = scoreMap.get(ws.userId) || 0;
        if (ws.score > existing) {
          scoreMap.set(ws.userId, ws.score);
        }
      }
    }
  } catch (err) {
    console.warn('[Leaderboard] Could not query activity scores:', err.message);
  }

  // 2. Fetch streaks for users (for tie-breaking and UI display)
  const streakMap = new Map();
  try {
    const streakList = await prisma.streakHistory.findMany({
      orderBy: { date: 'desc' },
      select: {
        userId: true,
        streakCount: true,
      },
    });

    for (const s of streakList) {
      if (!streakMap.has(s.userId)) {
        streakMap.set(s.userId, s.streakCount);
      }
    }
  } catch (err) {
    console.warn('[Leaderboard] Could not query streak history:', err.message);
  }

  // 3. Build ranked collection with real users from database
  const rankedUsers = users.map((u) => {
    const points = scoreMap.get(u.id) || 0;
    const streak = streakMap.get(u.id) || 0;
    const rawName = u.name || (u.email ? u.email.split('@')[0] : 'Learner');
    const firstWord = rawName.trim().split(/\s+/)[0] || 'Learner';
    const formattedName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

    return {
      userId: u.id,
      name: formattedName,
      email: u.email,
      points,
      streak,
      createdAt: u.createdAt,
    };
  });

  // 4. Merge mock cohort learners (active in non-test mode)
  if (process.env.NODE_ENV !== 'test') {
    for (const mock of MOCK_COHORT_LEARNERS) {
      // Ensure mock user isn't duplicated if id matches
      if (!rankedUsers.some((u) => u.userId === mock.id)) {
        rankedUsers.push({
          userId: mock.id,
          name: mock.name,
          email: mock.email,
          points: (mock.scores && mock.scores[timeframe] !== undefined) ? mock.scores[timeframe] : (mock.scores?.week || 0),
          streak: mock.streak,
          createdAt: mock.createdAt,
        });
      }
    }
  }

  if (rankedUsers.length === 0) return [];

  // 5. Sort with deterministic tie-breaking rules:
  // Primary: points DESC
  // Tie-breaker 1: streak DESC
  // Tie-breaker 2: createdAt ASC (senior learner wins tie)
  rankedUsers.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.streak !== a.streak) {
      return b.streak - a.streak;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // 6. Assign ordinal ranks (1, 2, 3...)
  return rankedUsers.map((item, index) => ({
    rank: index + 1,
    userId: item.userId,
    name: item.name,
    points: item.points,
    streak: item.streak,
    status: item.points > 0 ? 'GOING' : 'PENDING',
  }));
}

/**
 * Structure a ranked array into podium (top 3) and remaining rankings list.
 * @param {Array} rankedList
 * @returns {{ podium: Array, rankings: Array }}
 */
function structureLeaderboardResponse(rankedList) {
  const PODIUM_CONFIGS = [
    { avatarBg: 'bg-amber-400', badge: '🥇 #1' },
    { avatarBg: 'bg-[#F25C3B]', badge: '🥈 #2' },
    { avatarBg: 'bg-amber-600', badge: '🥉 #3' },
  ];

  const podium = rankedList.slice(0, 3).map((item, idx) => ({
    ...item,
    avatarBg: PODIUM_CONFIGS[idx] ? PODIUM_CONFIGS[idx].avatarBg : 'bg-gray-400',
    badge: PODIUM_CONFIGS[idx] ? PODIUM_CONFIGS[idx].badge : `#${item.rank}`,
  }));

  const rankings = rankedList.slice(3);

  return {
    podium,
    rankings,
  };
}

/**
 * Retrieve Leaderboard with Redis caching and automatic fallback to Database.
 *
 * @param {string} [timeframe='week'] - 'day' | 'week' | 'month' | 'all_time'
 * @param {Object} [options]
 * @param {boolean} [options.bypassCache=false]
 * @returns {Promise<Object>}
 */
async function getLeaderboard(timeframe = 'week', options = {}) {
  const normalizedTimeframe = ['day', 'week', 'month', 'all_time'].includes(timeframe)
    ? timeframe
    : 'week';
  const cacheKey = `leaderboard:${normalizedTimeframe}`;

  // 1. Try Redis cache first (if available and not bypassed)
  if (!options.bypassCache && redis.isAvailable()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          success: true,
          timeframe: normalizedTimeframe,
          periodLabel: getTimeframeLabel(normalizedTimeframe),
          source: 'cache',
          ...parsed,
        };
      }
    } catch {
      // Fall through on cache error
    }
  }

  // 2. Cache miss or Redis offline: Compute from Database
  const rankedList = await computeLeaderboardFromDatabase(normalizedTimeframe);
  const structured = structureLeaderboardResponse(rankedList);

  const payload = {
    totalLearners: rankedList.length,
    podium: structured.podium,
    rankings: structured.rankings,
    allRanks: rankedList,
  };

  // 3. Populate Redis Cache asynchronously if online
  if (redis.isAvailable()) {
    try {
      await redis.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);

      // Also populate Redis Sorted Set (ZSET) for fast rank queries
      const zsetKey = `leaderboard_zset:${normalizedTimeframe}`;
      for (const item of rankedList) {
        await redis.zadd(zsetKey, item.points, item.userId);
      }
    } catch (err) {
      console.warn('[Leaderboard] Failed to populate Redis cache:', err.message);
    }
  }

  return {
    success: true,
    timeframe: normalizedTimeframe,
    periodLabel: getTimeframeLabel(normalizedTimeframe),
    source: 'database',
    ...payload,
  };
}

/**
 * Retrieve user's rank, score, and surrounding peer group (above and below).
 *
 * @param {string} userId - User UUID
 * @param {string} [timeframe='week']
 * @param {number} [radius=3] - Number of peers above and below
 * @returns {Promise<Object>}
 */
async function getUserRankAndSurroundings(userId, timeframe = 'week', radius = 3) {
  const normalizedTimeframe = ['day', 'week', 'month', 'all_time'].includes(timeframe)
    ? timeframe
    : 'week';
  const parsedRadius = Number.parseInt(radius, 10);
  const safeRadius = Math.min(
    Math.max(Number.isFinite(parsedRadius) ? parsedRadius : 3, 1),
    20
  );

  // Authoritative ranking: query cached/computed complete ranked leaderboard
  const leaderboard = await getLeaderboard(normalizedTimeframe);
  const allRanks = leaderboard.allRanks || [];

  let userRankItem = allRanks.find((r) => r.userId === userId);
  let userIndex = allRanks.findIndex((r) => r.userId === userId);

  // If user is not yet in leaderboard list, calculate fallback profile
  if (!userRankItem) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const userStreak = await streakService.calculateUserStreak(userId, { persist: false });

    userRankItem = {
      rank: allRanks.length + 1,
      userId,
      name: user ? user.name || user.email.split('@')[0] : 'You',
      points: 0,
      streak: userStreak.currentStreak,
      status: 'PENDING',
    };
    userIndex = allRanks.length;
  }

  // Calculate surrounding window (e.g. radius above and radius below)
  const startIndex = Math.max(0, userIndex - safeRadius);
  const endIndex = Math.min(allRanks.length, userIndex + safeRadius + 1);
  const surroundingUsers = allRanks.slice(startIndex, endIndex);

  return {
    success: true,
    timeframe: normalizedTimeframe,
    periodLabel: leaderboard.periodLabel,
    source: leaderboard.source,
    userRank: userRankItem.rank,
    userPoints: userRankItem.points,
    userStreak: userRankItem.streak,
    totalLearners: leaderboard.totalLearners,
    surroundingUsers,
  };
}

/**
 * Invalidate cached leaderboard keys across Redis.
 * Called automatically when points change or tasks are completed.
 * @param {string|string[]} [timeframe] - Single timeframe or array of timeframes ('day' | 'week' | 'month' | 'all_time')
 */
async function invalidateLeaderboardCache(timeframe) {
  if (!redis.isAvailable()) return;

  try {
    if (Array.isArray(timeframe)) {
      const keysToDelete = [];
      for (const tf of timeframe) {
        keysToDelete.push(`leaderboard:${tf}`, `leaderboard_zset:${tf}`);
      }
      if (keysToDelete.length > 0) {
        await redis.del(keysToDelete);
      }
    } else if (timeframe && typeof timeframe === 'string') {
      await redis.del([`leaderboard:${timeframe}`, `leaderboard_zset:${timeframe}`]);
    } else {
      await redis.del([
        'leaderboard:day',
        'leaderboard:week',
        'leaderboard:month',
        'leaderboard:all_time',
        'leaderboard_zset:day',
        'leaderboard_zset:week',
        'leaderboard_zset:month',
        'leaderboard_zset:all_time',
      ]);
    }
  } catch (err) {
    console.warn('[Leaderboard] Error invalidating cache:', err.message);
  }
}

/**
 * Recalculate and re-warm all leaderboard caches in Redis and sync DB cache table.
 */
async function refreshAllLeaderboards() {
  console.log('[Leaderboard] Re-computing and refreshing leaderboard caches...');

  for (const tf of ['day', 'week', 'month', 'all_time']) {
    try {
      const data = await getLeaderboard(tf, { bypassCache: true });

      // Update Prisma leaderboard_cache table for fallback resilience
      if (tf === 'week' && data.allRanks) {
        await prisma.leaderboardCache.deleteMany({ where: { category: 'global' } });
        for (const item of data.allRanks.slice(0, 50)) {
          await prisma.leaderboardCache.create({
            data: {
              category: 'global',
              rank: item.rank,
              userId: item.userId,
              score: item.points,
            },
          });
        }
      }
    } catch (err) {
      console.error(`[Leaderboard] Error refreshing timeframe ${tf}:`, err.message);
    }
  }

  console.log('[Leaderboard] Leaderboards refreshed successfully.');
}

module.exports = {
  getLeaderboard,
  getUserRankAndSurroundings,
  computeLeaderboardFromDatabase,
  invalidateLeaderboardCache,
  refreshAllLeaderboards,
  getStartOfWeek,
  getStartOfMonth,
  getStartOfDay,
};
