import { getAuthToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  time: string;
  date: string;
  isRecurring: boolean;
  recurringType: 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';
  recurringDays: string | null;
  status: 'DONE' | 'PENDING';
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: string;
  time?: string;
  date?: string;
  isRecurring?: boolean;
  recurringType?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';
  recurringDays?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  category?: string;
  time?: string;
  date?: string;
  isRecurring?: boolean;
  recurringType?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';
  recurringDays?: string;
}

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
  completed?: boolean;
  pointsDelta: number;
  pointsAwarded: number;
}

/**
 * Fetch all tasks active for a specific date (YYYY-MM-DD), with completion status attached.
 */
export async function fetchTasksForDate(dateStr: string): Promise<TaskItem[]> {
  const token = await getAuthToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks?date=${dateStr}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.tasks)) {
      return data.tasks;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch tasks for date:', dateStr, error);
    return [];
  }
}

/**
 * Fetch tasks grouped by date across a range (startDate to endDate) in a single request.
 */
export async function fetchTasksCalendarRange(
  startDate: string,
  endDate: string
): Promise<Record<string, TaskItem[]>> {
  const token = await getAuthToken();
  if (!token) {
    return {};
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/tasks/calendar?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    if (data.success && data.calendar) {
      return data.calendar;
    }
    return {};
  } catch (error) {
    console.error('Failed to fetch calendar range:', startDate, endDate, error);
    return {};
  }
}

/**
 * Create a new task (one-time or recurring).
 */
export async function createTaskApi(input: CreateTaskInput): Promise<TaskItem | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.success && data.task) {
      return data.task;
    }
    return null;
  } catch (error) {
    console.error('Failed to create task:', error);
    return null;
  }
}

/**
 * Update an existing task.
 */
export async function updateTaskApi(taskId: string, input: UpdateTaskInput): Promise<TaskItem | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.success && data.task) {
      return data.task;
    }
    return null;
  } catch (error) {
    console.error('Failed to update task:', error);
    return null;
  }
}

/**
 * Delete an existing task.
 */
export async function deleteTaskApi(taskId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return Boolean(data.success);
  } catch (error) {
    console.error('Failed to delete task:', error);
    return false;
  }
}

/**
 * Toggle or update the completion state of a task on a specific date.
 */
export async function toggleTaskCompletion(
  taskId: string,
  dateStr: string,
  completed: boolean,
  timezone?: string
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
        Authorization: `Bearer ${token}`,
        ...(timezone ? { 'X-Timezone': timezone } : {}),
      },
      body: JSON.stringify({
        taskId,
        date: dateStr,
        completed,
        timezone,
      }),
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

/**
 * Legacy helper to fetch all completion mappings for a date.
 */
export async function fetchDateCompletions(dateStr: string): Promise<Record<string, boolean>> {
  const token = await getAuthToken();
  if (!token) {
    return {};
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/completions?date=${dateStr}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
