import { getAuthToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface TaskCompletionRecord {
  id: string;
  userId: string;
  taskId: string;
  date: string;
  completed: boolean;
  completedAt: string;
}

export interface ToggleTaskResponse {
  success: boolean;
  completion: TaskCompletionRecord;
  pointsAwarded: number;
}

/**
 * Fetch all task completion states for a given date (YYYY-MM-DD) from the backend.
 * @param dateStr - "YYYY-MM-DD"
 */
export async function fetchDateCompletions(dateStr: string): Promise<Record<string, boolean>> {
  const token = await getAuthToken();
  if (!token) {
    return {};
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/completions?date=${dateStr}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    if (data.success && data.completions) {
      return data.completions;
    }
    return {};
  } catch (error) {
    console.error('Failed to fetch completions for date:', dateStr, error);
    return {};
  }
}

/**
 * Toggle or update the completion state of a task on a specific date.
 * @param taskId - Task identifier
 * @param dateStr - "YYYY-MM-DD"
 * @param completed - boolean
 */
export async function toggleTaskCompletion(
  taskId: string,
  dateStr: string,
  completed: boolean
): Promise<ToggleTaskResponse | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        taskId,
        date: dateStr,
        completed
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.success) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to toggle task completion:', error);
    return null;
  }
}
