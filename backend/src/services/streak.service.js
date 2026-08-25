const prisma = require('../config/prisma');

/**
 * Helper: Format a Date object to YYYY-MM-DD string in UTC.
 * @param {Date} date
 * @returns {string} "YYYY-MM-DD"
 */
function formatDateToISO(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Helper: Shift an ISO date string ("YYYY-MM-DD") by N days.
 * Pure calendar arithmetic to avoid Daylight Saving Time (DST) or 23h/25h skew.
 * @param {string} dateString - "YYYY-MM-DD"
 * @param {number} days - Positive or negative integer
 * @returns {string} "YYYY-MM-DD"
 */
function shiftDateDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateToISO(date);
}

/**
 * Helper: Calculate calendar day difference between two ISO date strings (d2 - d1).
 * @param {string} dateString1 - "YYYY-MM-DD"
 * @param {string} dateString2 - "YYYY-MM-DD"
 * @returns {number} Difference in calendar days
 */
function getDaysDifference(dateString1, dateString2) {
  const [y1, m1, d1] = dateString1.split('-').map(Number);
  const [y2, m2, d2] = dateString2.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Helper: Get today's ISO date string in a specified timezone.
 * Defaults to client-passed timezone, environment default, or UTC.
 * @param {string} [timezone] - e.g. "Asia/Kolkata", "America/New_York", "UTC"
 * @returns {string} "YYYY-MM-DD"
 */
function getTodayInTimezone(timezone) {
  try {
    if (timezone) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    }
  } catch {
    // If invalid timezone string provided, fallback safely to UTC
  }

  const now = new Date();
  return formatDateToISO(now);
}

/**
 * Core Algorithm: Calculate dynamic streak metrics from an array/Set of distinct active dates.
 * 
 * Rules:
 * 1. An active date is any unique "YYYY-MM-DD" where the user completed at least one task/activity.
 * 2. Multiple activities on the same date count as 1 active day (no artificial streak inflation).
 * 3. If the user was active on `today`:
 *    - Current streak is consecutive days counting backwards from `today`.
 *    - `isActiveToday = true`, `isAtRisk = false`.
 * 4. If the user was NOT active on `today`:
 *    - If active `yesterday`: The streak is still alive (within the 24-hour daily grace period!).
 *      Streak is consecutive days counting backwards from `yesterday`.
 *      `isActiveToday = false`, `isAtRisk = true` (needs activity today to keep going).
 *    - If NOT active `yesterday`: The streak has reset to 0 (24h+ inactivity broken).
 *      `isActiveToday = false`, `isAtRisk = false`, `currentStreak = 0`.
 * 5. Longest streak is the maximum consecutive chain of active days across user's history.
 *
 * @param {Set<string>|Array<string>} activeDatesInput - Collection of "YYYY-MM-DD" strings
 * @param {string} todayDateString - "YYYY-MM-DD" representing current reference day
 * @returns {Object} Calculated streak metrics
 */
function calculateStreakFromActiveDates(activeDatesInput, todayDateString) {
  const activeDateSet = new Set(activeDatesInput);
  const sortedDates = Array.from(activeDateSet).sort(); // Ascending "YYYY-MM-DD"

  const yesterdayDateString = shiftDateDays(todayDateString, -1);
  const isActiveToday = activeDateSet.has(todayDateString);
  const isActiveYesterday = activeDateSet.has(yesterdayDateString);

  let currentStreak = 0;
  let isAtRisk = false;

  // 1. Calculate Current Streak
  if (isActiveToday) {
    // Active today: count consecutive days backwards starting from today
    let checkDate = todayDateString;
    while (activeDateSet.has(checkDate)) {
      currentStreak += 1;
      checkDate = shiftDateDays(checkDate, -1);
    }
    isAtRisk = false;
  } else if (isActiveYesterday) {
    // Active yesterday but not yet today: 24h grace window (streak is alive, but at risk)
    let checkDate = yesterdayDateString;
    while (activeDateSet.has(checkDate)) {
      currentStreak += 1;
      checkDate = shiftDateDays(checkDate, -1);
    }
    isAtRisk = true;
  } else {
    // Inactivity for > 24 hours (missed yesterday and today)
    currentStreak = 0;
    isAtRisk = false;
  }

  // 2. Calculate Longest Streak Across Entire History
  let longestStreak = 0;
  let currentChain = 0;
  let previousDate = null;

  for (const dateStr of sortedDates) {
    if (!previousDate) {
      currentChain = 1;
    } else {
      const diff = getDaysDifference(previousDate, dateStr);
      if (diff === 1) {
        // Consecutive calendar day
        currentChain += 1;
      } else if (diff === 0) {
        // Duplicate date (already deduped by Set, but safe guard)
        // do nothing
      } else {
        // Gap of > 1 day encountered: chain reset
        currentChain = 1;
      }
    }

    if (currentChain > longestStreak) {
      longestStreak = currentChain;
    }
    previousDate = dateStr;
  }

  // Ensure longestStreak is at least currentStreak
  longestStreak = Math.max(longestStreak, currentStreak);

  // 3. Find Last Active Date
  const lastActiveDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

  return {
    currentStreak,
    longestStreak,
    isActiveToday,
    isAtRisk,
    totalActiveDays: sortedDates.length,
    lastActiveDate,
    today: todayDateString,
    activeDates: sortedDates,
  };
}

/**
 * Fetch all completed task dates and activity dates from the database for a user.
 * Combines TaskCompletion (completed: true) and Activity records.
 *
 * @param {string} userId - User UUID
 * @param {string} [timezone] - Client timezone for activity timestamp conversion
 * @returns {Promise<Set<string>>} Distinct set of "YYYY-MM-DD" active dates
 */
async function fetchUserActiveDatesFromDb(userId, timezone) {
  // 1. Fetch completed task dates
  const completions = await prisma.taskCompletion.findMany({
    where: {
      userId,
      completed: true,
    },
    select: {
      date: true,
    },
  });

  const activeDates = new Set();
  for (const c of completions) {
    if (c.date && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) {
      activeDates.add(c.date);
    }
  }

  // 2. Fetch learning activity logs (quizzes, lessons, assessments) excluding task completions (which are tracked via TaskCompletion)
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      points: { gt: 0 },
      activityType: { not: 'task_completion' },
    },
    select: {
      timestamp: true,
      metadata: true,
    },
  });

  for (const a of activities) {
    // If metadata contains explicit date, use it
    if (a.metadata) {
      try {
        const meta = JSON.parse(a.metadata);
        if (meta.date && /^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
          activeDates.add(meta.date);
          continue;
        }
      } catch {
        // not json, proceed to timestamp
      }
    }

    if (a.timestamp) {
      const actDate = new Date(a.timestamp);
      let dateStr;
      if (timezone) {
        try {
          dateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(actDate);
        } catch {
          dateStr = formatDateToISO(actDate);
        }
      } else {
        dateStr = formatDateToISO(actDate);
      }
      activeDates.add(dateStr);
    }
  }

  return activeDates;
}

/**
 * Calculate the user's live streak strictly from persistent database data.
 *
 * @param {string} userId - User UUID
 * @param {Object} [options]
 * @param {string} [options.timezone] - Timezone string (e.g. "Asia/Kolkata")
 * @param {string} [options.referenceDate] - Override today's date ("YYYY-MM-DD") for testing/demo
 * @param {boolean} [options.persist] - Whether to sync calculated streak to StreakHistory table
 * @returns {Promise<Object>}
 */
async function calculateUserStreak(userId, options = {}) {
  const { timezone, referenceDate, persist = true } = options;

  // Determine reference "today" date
  const todayDateString = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : getTodayInTimezone(timezone);

  // Fetch all active dates from database
  const activeDates = await fetchUserActiveDatesFromDb(userId, timezone);

  // Perform pure, database-driven calculation from all active dates
  const streakMetrics = calculateStreakFromActiveDates(activeDates, todayDateString);

  // Persist current streak snapshot to database if requested
  if (persist) {
    try {
      const [y, m, d] = todayDateString.split('-').map(Number);
      const normalizedDayDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

      await prisma.streakHistory.upsert({
        where: {
          userId_date: {
            userId,
            date: normalizedDayDate,
          },
        },
        update: {
          streakCount: streakMetrics.currentStreak,
          frozen: false,
        },
        create: {
          userId,
          date: normalizedDayDate,
          streakCount: streakMetrics.currentStreak,
          frozen: false,
        },
      });
    } catch {
      // Non-blocking log if upsert encounters issue
    }
  }

  return streakMetrics;
}

/**
 * Get detailed streak history timeline and weekly calendar matrix.
 *
 * @param {string} userId - User UUID
 * @param {Object} [options]
 * @param {string} [options.timezone]
 * @param {string} [options.referenceDate]
 * @returns {Promise<Object>}
 */
async function getUserStreakHistory(userId, options = {}) {
  const streakMetrics = await calculateUserStreak(userId, { ...options, persist: false });
  const { today, activeDates } = streakMetrics;
  const activeSet = new Set(activeDates);

  // Build 7-day current week matrix (Mon-Sun)
  const [y, m, d] = today.split('-').map(Number);
  const targetDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  
  // Calculate Monday offset
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayDateStr = shiftDateDays(today, mondayOffset);

  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekCalendar = [];

  for (let i = 0; i < 7; i++) {
    const dayStr = shiftDateDays(mondayDateStr, i);
    const isCompleted = activeSet.has(dayStr);
    const isToday = dayStr === today;
    const isPast = getDaysDifference(dayStr, today) > 0;

    weekCalendar.push({
      dayName: DAYS_SHORT[i],
      date: dayStr,
      completed: isCompleted,
      isToday,
      isPast,
    });
  }

  return {
    ...streakMetrics,
    weekCalendar,
  };
}

module.exports = {
  calculateStreakFromActiveDates,
  calculateUserStreak,
  getUserStreakHistory,
  fetchUserActiveDatesFromDb,
  formatDateToISO,
  shiftDateDays,
  getDaysDifference,
  getTodayInTimezone,
};
