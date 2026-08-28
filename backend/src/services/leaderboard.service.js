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

/**
 * Compute raw leaderboard scores and rankings from database across all users.
 * @param {string} timeframe - 'day' | 'week' | 'month' | 'all_time'
 * @returns {Promise<Array>} Ranked user list
 */
async function computeLeaderboardFromDatabase(timeframe = 'week') {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (users.length === 0) return [];

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

  // Aggregate points per user
  const scoreMap = new Map();
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

  // 2. Fetch streaks for users (for tie-breaking and UI display)
  const streakList = await prisma.streakHistory.findMany({
    orderBy: { date: 'desc' },
    select: {
      userId: true,
      streakCount: true,
    },
  });

  const streakMap = new Map();
  for (const s of streakList) {
    if (!streakMap.has(s.userId)) {
      streakMap.set(s.userId, s.streakCount);
    }
  }

  // 3. Build ranked collection
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

  // 4. Sort with deterministic tie-breaking rules:
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

  // 5. Assign ordinal ranks (1, 2, 3...)
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
  const zsetKey = `leaderboard_zset:${normalizedTimeframe}`;
  const cacheKey = `leaderboard:${normalizedTimeframe}`;

  // 1. Query Redis ZSET for fast O(log N) dynamic rank & surroundings when available
  if (redis.isAvailable()) {
    try {
      const rank0 = await redis.zrevrank(zsetKey, userId);
      if (rank0 !== null && rank0 !== undefined) {
        const userRank = rank0 + 1;
        const userScore = (await redis.zscore(zsetKey, userId)) ?? 0;

        // Query surrounding window of user IDs from ZSET
        const startIdx = Math.max(0, rank0 - safeRadius);
        const stopIdx = rank0 + safeRadius;
        const surroundingIds = await redis.zrevrange(zsetKey, startIdx, stopIdx);

        // Fetch user metadata for enrichment
        // Tier 1: Try reading cached full leaderboard JSON
        let cachedData = null;
        const cachedRaw = await redis.get(cacheKey);
        if (cachedRaw) {
          try {
            cachedData = JSON.parse(cachedRaw);
          } catch {
            cachedData = null;
          }
        }

        const rankMap = new Map();
        if (cachedData && Array.isArray(cachedData.allRanks)) {
          for (const item of cachedData.allRanks) {
            rankMap.set(item.userId, item);
          }
        }

        // Enrich surrounding users
        const missingIds = [];
        const surroundingUsers = [];

        for (let i = 0; i < surroundingIds.length; i++) {
          const uId = surroundingIds[i];
          const rank = startIdx + i + 1;

          if (rankMap.has(uId)) {
            const item = rankMap.get(uId);
            surroundingUsers.push({
              ...item,
              rank,
            });
          } else {
            missingIds.push({ uId, rank, index: i });
            surroundingUsers.push(null); // placeholder for Tier 2 DB batch fallback
          }
        }

        // Tier 2: DB batch fallback for any IDs not found in cached JSON
        if (missingIds.length > 0) {
          const dbUsers = await prisma.user.findMany({
            where: { id: { in: missingIds.map((m) => m.uId) } },
            select: { id: true, name: true, email: true },
          });
          const dbUserMap = new Map(dbUsers.map((u) => [u.id, u]));

          for (const { uId, rank, index } of missingIds) {
            const u = dbUserMap.get(uId);
            const score = (await redis.zscore(zsetKey, uId)) ?? 0;
            const rawName = u ? u.name || (u.email ? u.email.split('@')[0] : 'Learner') : 'Learner';
            const firstWord = rawName.trim().split(/\s+/)[0] || 'Learner';
            const formattedName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

            surroundingUsers[index] = {
              rank,
              userId: uId,
              name: formattedName,
              points: score,
              streak: 0,
              status: score > 0 ? 'GOING' : 'PENDING',
            };
          }
        }

        const selfItem = rankMap.get(userId);
        let userStreak = 0;
        if (selfItem) {
          userStreak = selfItem.streak || 0;
        } else {
          const streakRes = await streakService.calculateUserStreak(userId, { persist: false });
          userStreak = streakRes.currentStreak;
        }

        const totalLearners = cachedData ? cachedData.totalLearners : (await prisma.user.count());

        return {
          success: true,
          timeframe: normalizedTimeframe,
          periodLabel: getTimeframeLabel(normalizedTimeframe),
          source: 'cache',
          userRank,
          userPoints: userScore,
          userStreak,
          totalLearners,
          surroundingUsers: surroundingUsers.filter(Boolean),
        };
      }
    } catch (err) {
      console.warn('[Leaderboard] ZSET rank lookup fallback:', err.message);
      // Fall through to getLeaderboard fallback
    }
  }

  // 2. Fallback: Array-based ranking when Redis is offline or user not in ZSET
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

  // Calculate surrounding window (e.g. 3 above and 3 below)
  const startIndex = Math.max(0, userIndex - radius);
  const endIndex = Math.min(allRanks.length, userIndex + radius + 1);
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
 * @param {string} [timeframe]
 */
async function invalidateLeaderboardCache(timeframe) {
  if (!redis.isAvailable()) return;

  try {
    if (timeframe) {
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
