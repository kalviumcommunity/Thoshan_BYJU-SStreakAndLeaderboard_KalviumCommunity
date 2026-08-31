import { apiFetch } from './apiClient';

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
  const params = new URLSearchParams();
  if (timezone) params.append('timezone', timezone);
  if (date) params.append('date', date);

  const endpoint = `/streak${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const response = await apiFetch(endpoint);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Failed to fetch streak data:', error);
    return null;
  }
}
