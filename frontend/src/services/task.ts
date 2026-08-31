import { apiFetch } from './apiClient';

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
  try {
    const response = await apiFetch(`/tasks?date=${dateStr}`);
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
  try {
    const response = await apiFetch(`/tasks/calendar?startDate=${startDate}&endDate=${endDate}`);
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
  try {
    const response = await apiFetch('/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error('Task API error:', err || response.statusText);
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
  try {
    const response = await apiFetch(`/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error('Task API error:', err || response.statusText);
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
  try {
    const response = await apiFetch(`/tasks/${taskId}`, {
      method: 'DELETE',
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
  try {
    const response = await apiFetch('/tasks/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(timezone ? { 'X-Timezone': timezone } : {}),
      },
      body: JSON.stringify({
        taskId,
        date: dateStr,
        completed,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error('Toggle Task API error:', err || response.statusText);
      return null;
    }

    const data = await response.json();
    if (data.success) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to toggle task:', error);
    return null;
  }
}
