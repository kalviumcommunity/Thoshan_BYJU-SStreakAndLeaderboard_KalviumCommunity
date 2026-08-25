import { getAuthToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  userStanding: {
    userRank: number;
    userPoints: number;
    userStreak: number;
  } | null;
}

/**
 * Fetch live leaderboard standings for a given timeframe ('day' | 'week' | 'month').
 */
export async function fetchLeaderboard(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<LeaderboardResponse | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard?timeframe=${timeframe}`, {
      headers,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('Failed to fetch leaderboard from API:', error);
    return null;
  }
}
