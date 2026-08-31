import { apiFetch } from './apiClient';

export interface PodiumLearner {
  rank: number;
  userId: string;
  name: string;
  points: number;
  streak: number;
  avatarBg: string;
  badge: string;
}

export interface RankedLearner {
  rank: number;
  userId: string;
  name: string;
  points: number;
  streak: number;
  status: string;
}

export interface LeaderboardResponse {
  success: boolean;
  timeframe: 'day' | 'week' | 'month' | 'all_time';
  periodLabel: string;
  source: 'cache' | 'database';
  totalLearners: number;
  podium: PodiumLearner[];
  rankings: RankedLearner[];
  allRanks?: RankedLearner[];
  userStanding: {
    userRank: number;
    userPoints: number;
    userStreak: number;
  } | null;
}

export interface UserStandingResponse {
  success: boolean;
  timeframe: string;
  periodLabel: string;
  source: 'cache' | 'database';
  userRank: number;
  userPoints: number;
  userStreak: number;
  totalLearners: number;
  surroundingUsers: RankedLearner[];
}

/**
 * Fetch live leaderboard standings for a given timeframe ('day' | 'week' | 'month').
 */
export async function fetchLeaderboard(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<LeaderboardResponse | null> {
  try {
    const response = await apiFetch(`/leaderboard?timeframe=${timeframe}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Failed to fetch leaderboard from API:', error);
    return null;
  }
}

/**
 * Fetch dedicated user rank and surrounding competitors.
 */
export async function fetchUserStanding(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<UserStandingResponse | null> {
  try {
    const response = await apiFetch(`/leaderboard/me?timeframe=${timeframe}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Failed to fetch user standing:', error);
    return null;
  }
}

/**
 * Trigger an instant refresh of leaderboard cache for the current user.
 */
export async function refreshLeaderboardApi(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<boolean> {
  try {
    const response = await apiFetch('/leaderboard/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timeframe }),
    });

    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.success);
  } catch (error) {
    console.error('Failed to trigger leaderboard refresh:', error);
    return false;
  }
}
