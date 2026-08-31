import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, subscribeToAuthState, type BackendUser } from '../services/auth';
import {
  fetchTasksForDate,
  fetchTasksCalendarRange,
  createTaskApi,
  updateTaskApi,
  deleteTaskApi,
  toggleTaskCompletion,
  type TaskItem,
  type CreateTaskInput,
} from '../services/task';
import { fetchStreakData, type StreakData } from '../services/streak';
import { fetchUserStanding, type UserStandingResponse } from '../services/leaderboard';
import ScreenLoader from '../components/ScreenLoader';

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDateShort = (date: Date): string => {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
};

const formatDateFull = (date: Date): string => {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export interface MonthGridDay {
  date: Date;
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasCompletedTasks: boolean;
  taskCount: number;
  completedCount: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navMessage, setNavMessage] = useState('Loading...');
  const [activeTab, setActiveTab] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [showSettings, setShowSettings] = useState(false);

  // Dynamic Full Date State (Defaults to current real-time date)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [scheduleStore, setScheduleStore] = useState<Record<string, TaskItem[]>>({});
  const [tasksLoading, setTasksLoading] = useState(false);

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [userStanding, setUserStanding] = useState<UserStandingResponse | null>(null);
  const [_standingLoading, setStandingLoading] = useState(false);
  const [togglingTaskIds, setTogglingTaskIds] = useState<Set<string>>(new Set());
  const [_toggleError, setToggleError] = useState<string | null>(null);

  // Toast / Snackbar Notification State
  const [toast, setToast] = useState<{ id: number; message: string; type?: 'success' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((prev) => (prev?.id === toast.id ? null : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Modal State for Add/Edit Task
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalCategory, setModalCategory] = useState('Core Concept');
  const [modalTime, setModalTime] = useState('9 AM');
  const [modalRecurrenceType, setModalRecurrenceType] = useState<'none' | 'daily' | 'weekdays' | 'custom'>('daily');
  const [modalCustomDays, setModalCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Auth Subscription
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAuthState((authUser) => {
      if (!authUser) {
        if (isMounted) {
          navigate('/login', { replace: true });
        }
        return;
      }

      if (isMounted) {
        setUser(authUser);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const dateKey = formatDateKey(currentDate);

  // Fetch Tasks for Selected Date from Live Backend API
  const loadTasksForDate = useCallback(async (dateStr: string) => {
    setTasksLoading(true);
    try {
      const tasks = await fetchTasksForDate(dateStr);
      setScheduleStore((prev) => ({
        ...prev,
        [dateStr]: tasks,
      }));
    } catch (err) {
      console.error('Error fetching date tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Fetch dynamic database streak info for current user
  const loadStreakData = useCallback(async (dateStr: string) => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await fetchStreakData(tz, dateStr);
      if (data) {
        setStreakData(data);
      }
    } catch (err) {
      console.error('Error fetching live streak:', err);
    }
  }, []);

  // Fetch live user rank and score standing on the cohort leaderboard
  const loadUserStanding = useCallback(async (timeframe: 'day' | 'week' | 'month' = 'week') => {
    setStandingLoading(true);
    try {
      const data = await fetchUserStanding(timeframe);
      if (data && data.success) {
        setUserStanding(data);
      }
    } catch (err) {
      console.error('Error fetching user standing:', err);
    } finally {
      setStandingLoading(false);
    }
  }, []);

  // Load calendar range for Week / Month views
  const loadCalendarRange = useCallback(async (startStr: string, endStr: string) => {
    try {
      const rangeData = await fetchTasksCalendarRange(startStr, endStr);
      if (rangeData && Object.keys(rangeData).length > 0) {
        setScheduleStore((prev) => ({
          ...prev,
          ...rangeData,
        }));
      }
    } catch (err) {
      console.error('Error fetching calendar range:', err);
    }
  }, []);

  useEffect(() => {
    loadTasksForDate(dateKey);
    loadStreakData(dateKey);
    const tf = activeTab.toLowerCase() as 'day' | 'week' | 'month';
    loadUserStanding(tf);
  }, [dateKey, activeTab, loadTasksForDate, loadStreakData, loadUserStanding]);

  const handleNavigate = (path: string, msg: string) => {
    setIsNavigating(true);
    setNavMessage(msg);
    setTimeout(() => {
      navigate(path);
    }, 280);
  };

  const handleLogout = async () => {
    try {
      setIsNavigating(true);
      setNavMessage('Signing out...');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      setIsNavigating(false);
    }
  };

  const currentTasks = scheduleStore[dateKey] || [];

  // Day View Navigation
  const prevDate = new Date(currentDate);
  prevDate.setDate(currentDate.getDate() - 1);

  const nextDate = new Date(currentDate);
  nextDate.setDate(currentDate.getDate() + 1);

  const changeDay = (delta: number) => {
    const updated = new Date(currentDate);
    updated.setDate(currentDate.getDate() + delta);
    setCurrentDate(updated);
  };

  // Real-Time Week View Calculations (Sunday to Saturday standard calendar week)
  const getCalendarWeek = (baseDate: Date, weekOffset = 0) => {
    const today = new Date();
    const target = new Date(baseDate);
    target.setDate(target.getDate() + weekOffset * 7);

    const dayOfWeek = target.getDay(); // 0=Sun, 1=Mon ... 6=Sat
    const sundayOffset = -dayOfWeek; // Standard Sunday-start calendar week

    const sunday = new Date(target);
    sunday.setDate(target.getDate() + sundayOffset);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dDate = new Date(sunday);
      dDate.setDate(sunday.getDate() + i);

      const isSelected = isSameDay(dDate, baseDate);
      const isCurrentDay = isSameDay(dDate, today);

      const dayKey = formatDateKey(dDate);
      const dayTasks = scheduleStore[dayKey] || [];
      const hasCompleted = dayTasks.some((t) => t.status === 'DONE');
      const completedCount = dayTasks.filter((t) => t.status === 'DONE').length;

      days.push({
        dayName: DAYS_FULL[dDate.getDay()].toUpperCase().slice(0, 3),
        dateNum: dDate.getDate(),
        date: dDate,
        isSelected,
        isToday: isCurrentDay,
        active: hasCompleted,
        taskCount: dayTasks.length,
        completedCount,
      });
    }

    const saturday = days[6].date;
    const label = `${days[0].date.getDate()} ${MONTHS_SHORT[days[0].date.getMonth()]} - ${saturday.getDate()} ${MONTHS_SHORT[saturday.getMonth()]} ${saturday.getFullYear()}`;

    return {
      label,
      days,
      startDay: days[0].date,
      endDay: saturday,
    };
  };

  const currentWeek = getCalendarWeek(currentDate, 0);
  const prevWeek = getCalendarWeek(currentDate, -1);
  const nextWeek = getCalendarWeek(currentDate, 1);

  const changeWeek = (offset: number) => {
    const updated = new Date(currentDate);
    updated.setDate(currentDate.getDate() + offset * 7);
    setCurrentDate(updated);
  };

  // Real-Time Google Calendar-Style Monthly Grid Calculation
  const getMonthGridDays = useCallback((date: Date): MonthGridDay[] => {
    const today = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid: MonthGridDay[] = [];

    // 1. Previous month leading padding days to align startDayOfWeek
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dDate = new Date(year, month - 1, d);
      const dateStr = formatDateKey(dDate);
      const dayTasks = scheduleStore[dateStr] || [];
      const completedCount = dayTasks.filter((t) => t.status === 'DONE').length;

      grid.push({
        date: dDate,
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: isSameDay(dDate, today),
        isSelected: isSameDay(dDate, currentDate),
        hasCompletedTasks: completedCount > 0,
        taskCount: dayTasks.length,
        completedCount,
      });
    }

    // 2. Current active month days (1 to daysInCurrentMonth)
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dDate = new Date(year, month, d);
      const dateStr = formatDateKey(dDate);
      const dayTasks = scheduleStore[dateStr] || [];
      const completedCount = dayTasks.filter((t) => t.status === 'DONE').length;

      grid.push({
        date: dDate,
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: isSameDay(dDate, today),
        isSelected: isSameDay(dDate, currentDate),
        hasCompletedTasks: completedCount > 0,
        taskCount: dayTasks.length,
        completedCount,
      });
    }

    // 3. Next month trailing padding days to fill 35 or 42 grid cells
    const remaining = grid.length % 7 === 0 ? 0 : 7 - (grid.length % 7);
    for (let d = 1; d <= remaining; d++) {
      const dDate = new Date(year, month + 1, d);
      const dateStr = formatDateKey(dDate);
      const dayTasks = scheduleStore[dateStr] || [];
      const completedCount = dayTasks.filter((t) => t.status === 'DONE').length;

      grid.push({
        date: dDate,
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: isSameDay(dDate, today),
        isSelected: isSameDay(dDate, currentDate),
        hasCompletedTasks: completedCount > 0,
        taskCount: dayTasks.length,
        completedCount,
      });
    }

    return grid;
  }, [currentDate, scheduleStore]);

  const monthGridDays = getMonthGridDays(currentDate);

  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  const changeMonth = (delta: number) => {
    const updated = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(updated);
  };

  const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  // Load calendar ranges on active tab change or navigation
  useEffect(() => {
    if (activeTab === 'Week') {
      const week = getCalendarWeek(currentDate, 0);
      const startStr = formatDateKey(week.startDay);
      const endStr = formatDateKey(week.endDay);
      loadCalendarRange(startStr, endStr);
    } else if (activeTab === 'Month') {
      const grid = getMonthGridDays(currentDate);
      if (grid.length > 0) {
        const startStr = grid[0].dateStr;
        const endStr = grid[grid.length - 1].dateStr;
        loadCalendarRange(startStr, endStr);
      }
    }
  }, [activeTab, currentDate, getMonthGridDays, loadCalendarRange]);

  const activeMonthDaysCount = monthGridDays
    .filter((d) => d.isCurrentMonth && d.hasCompletedTasks)
    .length;

  // Toggle Task Completion Handler with Optimistic UI & Rollback
  const toggleTask = async (taskId: string) => {
    if (togglingTaskIds.has(taskId)) return;
    setToggleError(null);
    setTogglingTaskIds((prev) => new Set(prev).add(taskId));

    const baseTasks = scheduleStore[dateKey] || [];
    const targetTask = baseTasks.find((t) => t.id === taskId);
    if (!targetTask) {
      setTogglingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      return;
    }

    const nextStatus = targetTask.status === 'DONE' ? 'PENDING' : 'DONE';
    const isCompleted = nextStatus === 'DONE';

    // 1. Optimistic UI update strictly for this date
    const updatedTasks: TaskItem[] = baseTasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: nextStatus as 'DONE' | 'PENDING',
          completed: isCompleted,
        };
      }
      return t;
    });
    setScheduleStore((prev) => ({ ...prev, [dateKey]: updatedTasks }));

    // 2. Persist to backend database for (userId, taskId, dateKey) with timezone and rollback
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await toggleTaskCompletion(taskId, dateKey, isCompleted, tz);
      if (response && response.success) {
        const pts = response.pointsDelta ?? (isCompleted ? 15 : -15);
        const deltaMsg = pts > 0 ? `+${pts}` : `${pts}`;
        showToast(isCompleted ? `Task completed! (${deltaMsg} pts)` : `Task marked as pending (${deltaMsg} pts)`);
        loadStreakData(dateKey);
        const tf = activeTab.toLowerCase() as 'day' | 'week' | 'month';
        loadUserStanding(tf);
      } else {
        // Rollback on failure
        setScheduleStore((prev) => ({ ...prev, [dateKey]: baseTasks }));
        setToggleError('Failed to update task. Changes were rolled back.');
      }
    } catch (err) {
      console.error('Failed to sync task toggle with backend:', err);
      // Rollback on error
      setScheduleStore((prev) => ({ ...prev, [dateKey]: baseTasks }));
      setToggleError('Network error syncing task. Changes were rolled back.');
    } finally {
      setTogglingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Open Create Task Modal
  const handleOpenCreateModal = () => {
    setEditingTaskId(null);
    setModalTitle('');
    setModalDescription('');
    setModalCategory('Core Concept');
    setModalTime('9 AM');
    setModalRecurrenceType('daily');
    setModalCustomDays([1, 2, 3, 4, 5]);
    setModalError(null);
    setIsTaskModalOpen(true);
  };

  // Open Edit Task Modal
  const handleOpenEditModal = (task: TaskItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTaskId(task.id);
    setModalTitle(task.title);
    setModalDescription(task.description || '');
    setModalCategory(task.category);
    setModalTime(task.time || '9 AM');

    if (!task.isRecurring) {
      setModalRecurrenceType('none');
    } else if (task.recurringType === 'weekdays') {
      setModalRecurrenceType('weekdays');
    } else if (task.recurringType === 'custom' || task.recurringType === 'weekly') {
      setModalRecurrenceType('custom');
      if (task.recurringDays) {
        setModalCustomDays(task.recurringDays.split(',').map((d) => parseInt(d.trim(), 10)));
      } else {
        setModalCustomDays([1, 3, 5]);
      }
    } else {
      setModalRecurrenceType('daily');
    }

    setModalError(null);
    setIsTaskModalOpen(true);
  };

  // Handle Delete Task Across All Loaded Calendar Dates
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const success = await deleteTaskApi(taskId);
      if (success) {
        // Remove from schedule store across ALL calendar dates
        setScheduleStore((prev) => {
          const updatedStore: Record<string, TaskItem[]> = {};
          for (const [key, tasks] of Object.entries(prev)) {
            updatedStore[key] = tasks.filter((t) => t.id !== taskId);
          }
          return updatedStore;
        });
        showToast('Task removed from your schedule', 'info');
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Handle Save Task (Create or Update)
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setModalError('Please enter a task title');
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    const isRecurring = modalRecurrenceType !== 'none';
    const recurringType = modalRecurrenceType === 'custom' ? 'custom' : modalRecurrenceType;
    const recurringDays = modalRecurrenceType === 'custom' ? modalCustomDays.join(',') : null;

    const taskPayload: CreateTaskInput = {
      title: modalTitle.trim(),
      description: modalDescription.trim() || undefined,
      category: modalCategory,
      time: modalTime.trim() || '10 AM',
      date: isRecurring ? undefined : dateKey,
      isRecurring,
      recurringType,
      recurringDays: recurringDays || undefined,
    };

    try {
      if (editingTaskId) {
        const updated = await updateTaskApi(editingTaskId, taskPayload);
        if (updated) {
          setIsTaskModalOpen(false);
          loadTasksForDate(dateKey);
          showToast('Task updated successfully!');
        } else {
          setModalError('Failed to update task. Please try again.');
        }
      } else {
        const created = await createTaskApi(taskPayload);
        if (created) {
          setIsTaskModalOpen(false);
          loadTasksForDate(dateKey);
          showToast('Learning task created successfully!');
        } else {
          setModalError('Failed to create task. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error saving task:', err);
      setModalError('An unexpected error occurred.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const toggleCustomDay = (dayIndex: number) => {
    setModalCustomDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const completedCount = currentTasks.filter((t) => t.status === 'DONE').length;
  const rawName = user?.name || (user?.email ? user.email.split('@')[0] : 'Learner');
  const firstWord = rawName.trim().split(/\s+/)[0] || 'Learner';
  const displayName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

  const baseStreak =
    typeof user?.latestStreak === 'object' && user?.latestStreak !== null && 'streakCount' in user.latestStreak
      ? Number((user.latestStreak as { streakCount?: number }).streakCount) || 0
      : 0;

  const currentStreak = streakData !== null ? streakData.currentStreak : baseStreak;

  if (loading || isNavigating) {
    return <ScreenLoader message={isNavigating ? navMessage : 'Loading your schedule...'} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#18191B] flex flex-col justify-between font-sans text-gray-100 select-none animate-screen">
      {/* TOP DARK SECTION */}
      <header className="w-full bg-[#18191B] pt-4 sm:pt-6 md:pt-8 pb-6 sm:pb-8 md:pb-10 px-4 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-7">
          {/* Top Status & Date Pill */}
          <div className="flex items-center justify-between text-xs sm:text-sm md:text-base pt-1">
            <div className="flex items-center space-x-2.5">
              <svg className="w-5 sm:w-6 md:w-7 h-5 sm:h-6 md:h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
              </svg>
              <span className="font-bold tracking-tight text-white/90 sm:text-base md:text-lg">byjus streak</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentDate(new Date())}
                className="bg-white/10 hover:bg-white/20 text-white/90 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full transition cursor-pointer flex items-center space-x-1"
                title="Jump to Today in Calendar"
              >
                <span>📅 Today</span>
              </button>
              <span className="text-gray-400 font-medium text-[11px] sm:text-sm md:text-base">
                {formatDateFull(currentDate)}
              </span>
              <span className="bg-[#F25C3B] text-white text-[10px] sm:text-xs md:text-sm font-black w-5 sm:w-7 md:w-8 h-5 sm:h-7 md:h-8 rounded-full flex items-center justify-center shadow-xs">
                {currentStreak}
              </span>
            </div>
          </div>

          {/* User Greeting & Menu Trigger */}
          <div className="flex items-start justify-between pt-1">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                Hola! {displayName}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-1 sm:mt-2">
                View & manage your daily learning schedule:
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 sm:p-3 hover:bg-white/10 rounded-xl sm:rounded-2xl transition cursor-pointer text-gray-300"
              aria-label="Settings"
            >
              <svg className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Filter Pills & Add Task Action */}
          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-black/30 p-1 sm:p-1.5 md:p-2 rounded-full border border-white/5">
              {(['Day', 'Week', 'Month'] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 sm:px-5 md:px-7 py-1.5 sm:py-2 md:py-2.5 rounded-full text-xs sm:text-sm md:text-base font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-md transform scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="bg-[#F25C3B] hover:bg-[#E04B2A] text-white px-4 sm:px-5 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span>+ Add Task</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/leaderboard', 'Loading live cohort standings...')}
                className="bg-white/10 hover:bg-white/20 text-white px-3.5 sm:px-4 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center space-x-1.5 transition cursor-pointer"
                title="View Full Cohort Standings"
              >
                <span>🏆 Ranks</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SETTINGS DRAWER OVERLAY */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full max-w-xs bg-[#18191B] h-full p-6 text-white flex flex-col justify-between border-l border-white/10 shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <span className="font-bold text-lg">Account & App</span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/10 rounded-xl cursor-pointer text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400">Signed in as</p>
                <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                <p className="text-xs text-[#F25C3B] font-medium">{displayName} • Learner</p>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    handleNavigate('/leaderboard', 'Opening cohort standings...');
                  }}
                  className="w-full text-left py-2 px-3 rounded-xl hover:bg-white/5 text-sm font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>🏆 Cohort Leaderboard</span>
                  <span className="text-gray-500">›</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    handleOpenCreateModal();
                  }}
                  className="w-full text-left py-2 px-3 rounded-xl hover:bg-white/5 text-sm font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>➕ Add Custom Schedule Task</span>
                  <span className="text-gray-500">›</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-gray-300 py-3 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT SECTION */}
      <main className="flex-1 bg-[#EFECE1] rounded-t-[32px] sm:rounded-t-[48px] px-4 sm:px-8 md:px-12 lg:px-16 pt-5 sm:pt-7 md:pt-9 pb-12 text-gray-900 shadow-2xl">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-7">
          {/* TAB 1: DAY VIEW */}
          {activeTab === 'Day' && (
            <div className="space-y-4 sm:space-y-6 animate-fadeIn">
              {/* Day Header Navigator */}
              <div className="flex items-center justify-between text-xs sm:text-base md:text-lg font-bold text-gray-400 px-2">
                <button
                  type="button"
                  onClick={() => changeDay(-1)}
                  className="px-2 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {formatDateShort(prevDate)}
                </button>

                <div className="flex items-center space-x-2 sm:space-x-3 text-gray-900">
                  <button
                    type="button"
                    onClick={() => changeDay(-1)}
                    className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full hover:bg-black/5 flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl cursor-pointer"
                  >
                    ‹
                  </button>
                  <span className="text-sm sm:text-base md:text-xl font-black text-[#F25C3B] bg-white/70 px-4 sm:px-6 md:px-8 py-1 sm:py-2 rounded-full shadow-xs">
                    {formatDateShort(currentDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeDay(1)}
                    className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full hover:bg-black/5 flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl cursor-pointer"
                  >
                    ›
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => changeDay(1)}
                  className="px-2 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {formatDateShort(nextDate)}
                </button>
              </div>

              {/* Milestone & Streak Overview Banner */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 flex items-center justify-between border border-gray-200 shadow-xs">
                <div className="flex items-center space-x-3.5 sm:space-x-6">
                  <div className="w-12 sm:w-16 md:w-20 h-14 sm:h-18 md:h-22 bg-[#F25C3B] text-white rounded-xl sm:rounded-2xl flex flex-col items-center justify-center shadow-xs">
                    <span className="text-base sm:text-xl md:text-3xl font-black leading-none">{currentStreak}</span>
                    <span className="text-[9px] sm:text-xs md:text-sm font-bold uppercase tracking-tight mt-0.5">DAYS</span>
                    <span className="text-[8px] sm:text-[10px] md:text-xs opacity-80 mt-0.5">🔥 STREAK</span>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900">Daily Study Milestone</h3>
                    <p className="text-xs sm:text-base md:text-lg text-gray-500 mt-0.5">
                      Progress: {completedCount}/{currentTasks.length} Completed
                    </p>
                    {userStanding?.totalLearners ? (
                      <p className="text-xs sm:text-sm md:text-base text-gray-400 flex items-center gap-1.5 mt-1.5">
                        👥 <span>{userStanding.totalLearners} Cohort Learners Active</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="bg-[#FCECE7] hover:bg-[#F25C3B] hover:text-white text-[#F25C3B] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>+ New</span>
                </button>
              </div>

              {/* Weekly Cohort Standings Mini Banner */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-gray-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3">
                  <span className="w-8 sm:w-10 h-8 sm:h-10 rounded-xl bg-amber-400 text-gray-950 font-black flex items-center justify-center text-xs sm:text-sm">
                    {userStanding?.userRank ? `#${userStanding.userRank}` : '#-'}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wide bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                        Cohort Standing
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-400">Live Standings</span>
                    </div>
                    <p className="text-xs sm:text-sm md:text-base font-bold text-gray-900 mt-0.5">
                      Weekly Cohort Standings
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigate('/leaderboard', 'Opening live leaderboard...')}
                  className="bg-[#18191B] hover:bg-black text-white px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>Leaderboard →</span>
                </button>
              </div>

              {/* Day Tasks List */}
              <div className="space-y-3 sm:space-y-4 pt-1">
                {tasksLoading ? (
                  <div className="p-8 text-center text-gray-500 bg-white/60 rounded-2xl">
                    Loading schedule for {formatDateShort(currentDate)}...
                  </div>
                ) : currentTasks.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 bg-white/60 rounded-2xl space-y-2">
                    <p className="font-bold text-gray-700">No tasks scheduled for this day.</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="text-[#F25C3B] font-bold text-sm underline cursor-pointer"
                    >
                      + Create a custom task for this date
                    </button>
                  </div>
                ) : (
                  currentTasks.map((task) => {
                    const isToggling = togglingTaskIds.has(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border flex items-center justify-between transition-all duration-200 select-none ${
                          isToggling ? 'opacity-60 pointer-events-none' : ''
                        } ${
                          task.status === 'DONE'
                            ? 'bg-[#EAE6D8] border-[#DFD9C6] shadow-xs'
                            : 'bg-white border-gray-200/90 shadow-xs hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div
                          onClick={() => toggleTask(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleTask(task.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={task.status === 'DONE'}
                          className="flex items-center space-x-3.5 sm:space-x-5 flex-1 min-w-0 pr-3 cursor-pointer"
                        >
                          <div className="w-14 sm:w-18 md:w-22 shrink-0">
                            <span className="inline-block bg-gray-100 text-gray-800 text-[11px] sm:text-xs md:text-sm font-black px-2.5 py-1 rounded-lg">
                              {task.time}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs sm:text-base md:text-lg font-bold transition-all truncate ${
                                task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-gray-950'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-2 text-[10px] sm:text-xs text-gray-500 mt-1 flex-wrap gap-y-1">
                              <span className="bg-[#FAF8F2] border border-gray-200 px-2 py-0.5 rounded-md font-semibold text-gray-700">
                                📚 {task.category}
                              </span>
                              {task.isRecurring && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-md font-bold">
                                  🔁 {task.recurringType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                          {/* Quick Edit and Delete buttons */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(task, e)}
                            title="Edit Task"
                            className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition cursor-pointer"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            title="Delete Task"
                            className="p-1.5 sm:p-2 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-700 transition cursor-pointer"
                          >
                            🗑️
                          </button>

                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => toggleTask(task.id)}
                            className={`cursor-pointer transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm font-black px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full shadow-xs disabled:opacity-50 ${
                              task.status === 'DONE'
                                ? 'bg-[#18191B] hover:bg-black text-white'
                                : 'bg-[#DFDACB] hover:bg-[#D0CAB9] text-gray-800'
                            }`}
                          >
                            {isToggling ? '...' : task.status === 'DONE' ? '✓ DONE' : '○ PENDING'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WEEK VIEW */}
          {activeTab === 'Week' && (
            <div className="space-y-5 sm:space-y-6 md:space-y-7 animate-fadeIn">
              {/* Weekly Header Navigator */}
              <div className="flex items-center justify-between text-xs sm:text-base md:text-lg font-bold text-gray-400 px-2">
                <button
                  type="button"
                  onClick={() => changeWeek(-1)}
                  className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {prevWeek.label}
                </button>

                <div className="flex items-center space-x-2 sm:space-x-3 text-gray-900">
                  <button
                    type="button"
                    onClick={() => changeWeek(-1)}
                    className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full hover:bg-black/5 flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl cursor-pointer"
                  >
                    ‹
                  </button>
                  <span className="text-sm sm:text-base md:text-xl font-black text-[#F25C3B] bg-white/70 px-4 sm:px-6 md:px-8 py-1 sm:py-2 rounded-full shadow-xs">
                    {currentWeek.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeWeek(1)}
                    className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full hover:bg-black/5 flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl cursor-pointer"
                  >
                    ›
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => changeWeek(1)}
                  className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {nextWeek.label}
                </button>
              </div>

              {/* Weekly Day Strip */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3 md:gap-4 text-center bg-white/80 p-3 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
                {currentWeek.days.map((w) => (
                  <button
                    type="button"
                    key={formatDateKey(w.date)}
                    onClick={() => setCurrentDate(w.date)}
                    className={`flex flex-col items-center p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl transition cursor-pointer relative ${
                      w.isSelected
                        ? 'bg-[#F25C3B] text-white shadow-md transform scale-105'
                        : w.isToday
                        ? 'bg-amber-50 text-gray-900 border border-amber-300'
                        : 'text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs md:text-sm font-bold opacity-75">{w.dayName}</span>
                    <span className="text-xs sm:text-base md:text-xl font-black mt-0.5">{w.dateNum}</span>
                    <span
                      className={`w-1.5 sm:w-2 md:w-2.5 h-1.5 sm:h-2 md:h-2.5 rounded-full mt-1.5 ${
                        w.active ? (w.isSelected ? 'bg-white' : 'bg-[#F25C3B]') : 'bg-gray-300'
                      }`}
                    ></span>
                  </button>
                ))}
              </div>

              {/* Weekly Schedule Slots for Selected Date */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs sm:text-base md:text-lg font-bold text-gray-700">
                    Schedule for {formatDateShort(currentDate)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="text-xs sm:text-sm font-bold text-[#F25C3B] hover:underline cursor-pointer"
                    >
                      + Add Task
                    </button>
                    <span className="text-xs sm:text-sm md:text-base font-bold text-[#F25C3B] bg-white/80 px-3 sm:px-4 py-1 rounded-full shadow-xs">
                      {completedCount}/{currentTasks.length} Completed
                    </span>
                  </div>
                </div>

                {tasksLoading ? (
                  <div className="p-8 text-center text-gray-500 bg-white/60 rounded-2xl">
                    Loading schedule for {formatDateShort(currentDate)}...
                  </div>
                ) : currentTasks.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 bg-white/60 rounded-2xl space-y-2">
                    <p className="font-bold text-gray-700">No tasks scheduled for this day.</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="text-[#F25C3B] font-bold text-sm underline cursor-pointer"
                    >
                      + Create a custom task for this date
                    </button>
                  </div>
                ) : (
                  currentTasks.map((task) => {
                    const isToggling = togglingTaskIds.has(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border flex items-center justify-between transition-all duration-200 select-none ${
                          isToggling ? 'opacity-60 pointer-events-none' : ''
                        } ${
                          task.status === 'DONE'
                            ? 'bg-[#EAE6D8] border-[#DFD9C6] shadow-xs'
                            : 'bg-white border-gray-200/90 shadow-xs hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div
                          onClick={() => toggleTask(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleTask(task.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={task.status === 'DONE'}
                          className="flex items-center space-x-3.5 sm:space-x-5 flex-1 min-w-0 pr-3 cursor-pointer"
                        >
                          <div className="w-14 sm:w-18 md:w-22 shrink-0">
                            <span className="inline-block bg-gray-100 text-gray-800 text-[11px] sm:text-xs md:text-sm font-black px-2.5 py-1 rounded-lg">
                              {task.time}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs sm:text-base md:text-lg font-bold transition-all truncate ${
                                task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-gray-950'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-2 text-[10px] sm:text-xs text-gray-500 mt-1 flex-wrap gap-y-1">
                              <span className="bg-[#FAF8F2] border border-gray-200 px-2 py-0.5 rounded-md font-semibold text-gray-700">
                                📚 {task.category}
                              </span>
                              {task.isRecurring && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-md font-bold">
                                  🔁 {task.recurringType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(task, e)}
                            title="Edit Task"
                            className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition cursor-pointer"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            title="Delete Task"
                            className="p-1.5 sm:p-2 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-700 transition cursor-pointer"
                          >
                            🗑️
                          </button>

                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => toggleTask(task.id)}
                            className={`cursor-pointer transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm font-black px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full shadow-xs disabled:opacity-50 ${
                              task.status === 'DONE'
                                ? 'bg-[#18191B] hover:bg-black text-white'
                                : 'bg-[#DFDACB] hover:bg-[#D0CAB9] text-gray-800'
                            }`}
                          >
                            {isToggling ? '...' : task.status === 'DONE' ? '✓ DONE' : '○ PENDING'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MONTH VIEW (Google Calendar Standard 7x6 Day Grid) */}
          {activeTab === 'Month' && (
            <div className="space-y-4 sm:space-y-6 md:space-y-7 animate-fadeIn">
              {/* Monthly Header Navigator */}
              <div className="flex items-center justify-between text-xs sm:text-base md:text-lg font-bold text-gray-400 px-2">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {MONTHS_SHORT[prevMonthDate.getMonth()]} {prevMonthDate.getFullYear()}
                </button>

                <div className="flex items-center space-x-2 sm:space-x-3 text-gray-900">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full hover:bg-black/5 flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl cursor-pointer"
                  >
                    ‹
                  </button>
                  <span className="text-sm sm:text-base md:text-xl font-black text-[#F25C3B] bg-white/70 px-4 sm:px-6 md:px-8 py-1 sm:py-2 rounded-full shadow-xs">
                    {MONTHS_FULL[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="w-8 sm:w-10 md:w-12 h-8 sm:h-10 md:h-12 rounded-full hover:bg-black/5 flex items-center justify-center font-black text-lg sm:text-xl md:text-2xl cursor-pointer"
                  >
                    ›
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {MONTHS_SHORT[nextMonthDate.getMonth()]} {nextMonthDate.getFullYear()}
                </button>
              </div>

              {/* Monthly Calendar Grid Card */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-xs space-y-4">
                {/* 7-Column Day Header */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs md:text-sm font-black text-gray-400 uppercase tracking-wider">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day Cells Grid */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                  {monthGridDays.map((d, idx) => {
                    return (
                      <button
                        type="button"
                        key={`${d.dateStr}-${idx}`}
                        onClick={() => setCurrentDate(d.date)}
                        className={`h-10 sm:h-13 md:h-16 rounded-xl sm:rounded-2xl flex flex-col items-center justify-between p-1.5 sm:p-2 font-bold transition cursor-pointer relative ${
                          d.isSelected
                            ? 'bg-[#F25C3B] text-white shadow-md transform scale-105 z-10'
                            : d.isToday
                            ? 'bg-amber-50 text-gray-950 border border-amber-300'
                            : d.isCurrentMonth
                            ? 'text-gray-800 hover:bg-gray-100'
                            : 'text-gray-400/50 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-xs sm:text-base md:text-lg leading-none">
                          {d.dayNum}
                        </span>

                        {/* Status indicators */}
                        <div className="flex items-center space-x-1">
                          {d.hasCompletedTasks && (
                            <span
                              className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${
                                d.isSelected ? 'bg-white' : 'bg-[#F25C3B]'
                              }`}
                              title={`${d.completedCount} completed task(s)`}
                            ></span>
                          )}
                          {d.isToday && !d.isSelected && (
                            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-amber-500" title="Today"></span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Habit Summary Card */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-200 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-xs sm:text-base md:text-lg font-bold text-gray-900">Monthly Habit Total</p>
                  <p className="text-xs sm:text-sm md:text-base text-gray-500 mt-0.5">
                    {activeMonthDaysCount} / {daysInCurrentMonth} Active Days
                    {userStanding?.userRank ? ` • Cohort Rank #${userStanding.userRank}` : ''}
                  </p>
                </div>
                <span className="text-xs sm:text-base md:text-lg font-black text-[#F25C3B] bg-[#FCECE7] px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full">
                  {userStanding?.userPoints !== undefined ? `${userStanding.userPoints} PTS` : `${activeMonthDaysCount * 15} PTS`}
                </span>
              </div>

              {/* Selected Day Schedule Details in Month View */}
              <div className="space-y-3 sm:space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs sm:text-base md:text-lg font-bold text-gray-700">
                    Schedule for {formatDateShort(currentDate)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="text-xs sm:text-sm font-bold text-[#F25C3B] hover:underline cursor-pointer"
                    >
                      + Add Task
                    </button>
                    <span className="text-xs sm:text-sm md:text-base font-bold text-[#F25C3B] bg-white/80 px-3 sm:px-4 py-1 rounded-full shadow-xs">
                      {completedCount}/{currentTasks.length} Completed
                    </span>
                  </div>
                </div>

                {tasksLoading ? (
                  <div className="p-8 text-center text-gray-500 bg-white/60 rounded-2xl">
                    Loading schedule for {formatDateShort(currentDate)}...
                  </div>
                ) : currentTasks.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 bg-white/60 rounded-2xl space-y-2">
                    <p className="font-bold text-gray-700">No tasks scheduled for this date.</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="text-[#F25C3B] font-bold text-sm underline cursor-pointer"
                    >
                      + Create a task for {formatDateShort(currentDate)}
                    </button>
                  </div>
                ) : (
                  currentTasks.map((task) => {
                    const isToggling = togglingTaskIds.has(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border flex items-center justify-between transition-all duration-200 select-none ${
                          isToggling ? 'opacity-60 pointer-events-none' : ''
                        } ${
                          task.status === 'DONE'
                            ? 'bg-[#EAE6D8] border-[#DFD9C6] shadow-xs'
                            : 'bg-white border-gray-200/90 shadow-xs hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div
                          onClick={() => toggleTask(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleTask(task.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={task.status === 'DONE'}
                          className="flex items-center space-x-3.5 sm:space-x-5 flex-1 min-w-0 pr-3 cursor-pointer"
                        >
                          <div className="w-14 sm:w-18 md:w-22 shrink-0">
                            <span className="inline-block bg-gray-100 text-gray-800 text-[11px] sm:text-xs md:text-sm font-black px-2.5 py-1 rounded-lg">
                              {task.time}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs sm:text-base md:text-lg font-bold transition-all truncate ${
                                task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-gray-950'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-2 text-[10px] sm:text-xs text-gray-500 mt-1 flex-wrap gap-y-1">
                              <span className="bg-[#FAF8F2] border border-gray-200 px-2 py-0.5 rounded-md font-semibold text-gray-700">
                                📚 {task.category}
                              </span>
                              {task.isRecurring && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-md font-bold">
                                  🔁 {task.recurringType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(task, e)}
                            title="Edit Task"
                            className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition cursor-pointer"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            title="Delete Task"
                            className="p-1.5 sm:p-2 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-700 transition cursor-pointer"
                          >
                            🗑️
                          </button>

                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => toggleTask(task.id)}
                            className={`cursor-pointer transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm font-black px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full shadow-xs disabled:opacity-50 ${
                              task.status === 'DONE'
                                ? 'bg-[#18191B] hover:bg-black text-white'
                                : 'bg-[#DFDACB] hover:bg-[#D0CAB9] text-gray-800'
                            }`}
                          >
                            {isToggling ? '...' : task.status === 'DONE' ? '✓ DONE' : '○ PENDING'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-4 sm:pt-6">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] text-white py-3.5 sm:py-4 md:py-5 rounded-2xl sm:rounded-3xl text-sm sm:text-base md:text-lg font-black tracking-tight shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>+ Add Learning Task</span>
            </button>
          </div>
        </div>
      </main>

      {/* Lightweight Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fadeIn flex items-center space-x-3 bg-[#18191B] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 max-w-sm">
          <span className="text-base text-[#F25C3B]">
            {toast.type === 'info' ? 'ℹ️' : '✓'}
          </span>
          <p className="text-xs sm:text-sm font-semibold flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* ADD / EDIT TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-gray-900 border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-xl font-black">{editingTaskId ? 'Edit Schedule Task' : 'Create Learning Task'}</h2>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mt-3 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-xl text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Physics: Optics & Wave Quiz"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description / Topic Focus (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solve 10 questions on Refraction and Snell's law"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                  >
                    <option value="Core Concept">Core Concept</option>
                    <option value="Quiz Practice">Quiz Practice</option>
                    <option value="Daily Task">Daily Task</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Scheduled Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10 AM, 3:30 PM"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Recurrence Schedule
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'daily', label: 'Every Day' },
                    { id: 'weekdays', label: 'Weekdays' },
                    { id: 'custom', label: 'Custom Days' },
                    { id: 'none', label: 'One-Time' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setModalRecurrenceType(r.id as typeof modalRecurrenceType)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer ${
                        modalRecurrenceType === r.id
                          ? 'bg-[#18191B] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {modalRecurrenceType === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Select Days of Week
                  </label>
                  <div className="flex justify-between gap-1">
                    {[
                      { idx: 1, label: 'M' },
                      { idx: 2, label: 'T' },
                      { idx: 3, label: 'W' },
                      { idx: 4, label: 'T' },
                      { idx: 5, label: 'F' },
                      { idx: 6, label: 'S' },
                      { idx: 0, label: 'S' },
                    ].map((day) => {
                      const isSelected = modalCustomDays.includes(day.idx);
                      return (
                        <button
                          type="button"
                          key={day.idx}
                          onClick={() => toggleCustomDay(day.idx)}
                          className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isSelected ? 'bg-[#F25C3B] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {modalRecurrenceType === 'none' && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  📅 This task is scheduled strictly for <strong>{formatDateFull(currentDate)}</strong>.
                </div>
              )}

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="flex-1 py-3 rounded-xl bg-[#F25C3B] hover:bg-[#E04B2A] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? 'Saving...' : editingTaskId ? 'Update Task' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
