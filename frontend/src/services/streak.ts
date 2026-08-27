import { getAuthToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface WeekCalendarDay {
  dayName: string;
  date: string;
  completed: boolean;
  isToday: boolean;
  isPast: boolean;
}

export interface StreakData {
  success: boolean;
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
  isAtRisk: boolean;
  totalActiveDays: number;
  lastActiveDate: string | null;
  today: string;
  activeDates: string[];
  weekCalendar?: WeekCalendarDay[];
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Fetch dynamic database-driven streak information for the authenticated user.
 * @param timezone - Optional client timezone (e.g., "Asia/Kolkata")
 * @param date - Optional reference date override ("YYYY-MM-DD")
 */
export async function fetchStreakData(timezone?: string, date?: string): Promise<StreakData | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const params = new URLSearchParams();
  if (timezone) params.append('timezone', timezone);
  if (date) params.append('date', date);

  const url = `${API_BASE_URL}/streak${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Failed to fetch streak data:', error);
    return null;
  }
}

/**
 * Fetch detailed streak history and 7-day weekly calendar matrix.
 */
export async function fetchStreakHistory(timezone?: string, date?: string): Promise<StreakData | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const params = new URLSearchParams();
  if (timezone) params.append('timezone', timezone);
  if (date) params.append('date', date);

  const url = `${API_BASE_URL}/streak/history${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Failed to fetch streak history:', error);
    return null;
  }
}
