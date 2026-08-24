import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, logout, subscribeToAuthState, type BackendUser } from '../services/auth';
import {
  fetchTasksForDate,
  createTaskApi,
  updateTaskApi,
  deleteTaskApi,
  toggleTaskCompletion,
  type TaskItem,
  type CreateTaskInput,
} from '../services/task';
import ScreenLoader from '../components/ScreenLoader';

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navMessage, setNavMessage] = useState('Loading...');
  const [activeTab, setActiveTab] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [showSettings, setShowSettings] = useState(false);

  // Dynamic Full Date State (Default: Dec 9, 2024 for demo)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2024, 11, 9));
  const [scheduleStore, setScheduleStore] = useState<Record<string, TaskItem[]>>({});
  const [tasksLoading, setTasksLoading] = useState(false);

  const [streakBonus, setStreakBonus] = useState(0);
  const [pointsBonus, setPointsBonus] = useState(0);

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

    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (!firebaseUser) {
        if (isMounted) {
          navigate('/login', { replace: true });
        }
        return;
      }

      try {
        const profile = await fetchProfile();
        if (isMounted) {
          setUser(profile);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        if (isMounted) {
          setUser({
            id: firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Damir',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setLoading(false);
        }
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

  useEffect(() => {
    loadTasksForDate(dateKey);
  }, [dateKey, loadTasksForDate]);

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

  // Week View Calculations
  const getWeekBlockData = (baseDate: Date, blockOffset = 0) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    const blockIndex = Math.floor((day - 1) / 7);
    let targetYear = year;
    let targetMonth = month;
    let targetBlockIndex = blockIndex + blockOffset;

    while (targetBlockIndex < 0) {
      targetMonth -= 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
      const daysInPrev = new Date(targetYear, targetMonth + 1, 0).getDate();
      const maxPrevBlock = Math.floor((daysInPrev - 1) / 7);
      targetBlockIndex += maxPrevBlock + 1;
    }

    while (true) {
      const daysInCur = new Date(targetYear, targetMonth + 1, 0).getDate();
      const maxCurBlock = Math.floor((daysInCur - 1) / 7);
      if (targetBlockIndex <= maxCurBlock) {
        break;
      }
      targetBlockIndex -= maxCurBlock + 1;
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const startDay = targetBlockIndex * 7 + 1;
    const endDay = Math.min((targetBlockIndex + 1) * 7, daysInTargetMonth);
    const monthName = MONTHS_SHORT[targetMonth];

    const days = [];
    for (let d = startDay; d <= endDay; d++) {
      const dDate = new Date(targetYear, targetMonth, d);
      const isSelected =
        baseDate.getFullYear() === targetYear &&
        baseDate.getMonth() === targetMonth &&
        baseDate.getDate() === d;

      const dayKey = formatDateKey(dDate);
      const dayTasks = scheduleStore[dayKey] || [];
      const hasCompleted = dayTasks.some((t) => t.status === 'DONE');

      days.push({
        dayName: DAYS_FULL[dDate.getDay()].toUpperCase(),
        dateNum: d,
        date: dDate,
        isSelected,
        active: hasCompleted,
      });
    }

    return {
      label: `${startDay}-${endDay} ${monthName}`,
      days,
      startDay,
      endDay,
      month: targetMonth,
      year: targetYear,
      blockIndex: targetBlockIndex,
    };
  };

  const currentWeek = getWeekBlockData(currentDate, 0);
  const prevWeek = getWeekBlockData(currentDate, -1);
  const nextWeek = getWeekBlockData(currentDate, 1);

  const changeWeek = (offset: number) => {
    const target = getWeekBlockData(currentDate, offset);
    const newDate = new Date(target.year, target.month, target.startDay);
    setCurrentDate(newDate);
  };

  // Month View Calculations
  const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthDaysList = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  const changeMonth = (delta: number) => {
    const updated = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(updated);
  };

  const activeMonthDaysCount = monthDaysList.filter((d) => {
    const mDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
    const mKey = formatDateKey(mDate);
    const mTasks = scheduleStore[mKey] || [];
    return mTasks.some((t) => t.status === 'DONE');
  }).length;

  // Toggle Task Completion Handler
  const toggleTask = async (taskId: string) => {
    const baseTasks = scheduleStore[dateKey] || [];
    const targetTask = baseTasks.find((t) => t.id === taskId);
    if (!targetTask) return;

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

    // 2. Persist to backend database for (userId, taskId, dateKey)
    try {
      const response = await toggleTaskCompletion(taskId, dateKey, isCompleted);
      if (response && response.pointsAwarded > 0) {
        setPointsBonus((prev) => prev + response.pointsAwarded);
        setStreakBonus(1);
      }
    } catch (err) {
      console.error('Failed to sync task toggle with backend:', err);
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

  // Handle Delete Task
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const success = await deleteTaskApi(taskId);
      if (success) {
        // Remove from schedule store
        setScheduleStore((prev) => ({
          ...prev,
          [dateKey]: (prev[dateKey] || []).filter((t) => t.id !== taskId),
        }));
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
        } else {
          setModalError('Failed to update task. Please try again.');
        }
      } else {
        const created = await createTaskApi(taskPayload);
        if (created) {
          setIsTaskModalOpen(false);
          loadTasksForDate(dateKey);
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
  const rawName = user?.name || (user?.email ? user.email.split('@')[0] : 'Damir');
  const firstWord = rawName.trim().split(/\s+/)[0] || 'Damir';
  const displayName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

  const baseStreak =
    typeof user?.latestStreak === 'object' && user?.latestStreak !== null && 'streakCount' in user.latestStreak
      ? Number((user.latestStreak as { streakCount?: number }).streakCount) || 15
      : 15;

  const currentStreak = baseStreak + streakBonus;

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

            <div className="flex items-center space-x-2.5">
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
                onClick={() => handleNavigate('/leaderboard', 'Opening Leaderboard...')}
                className="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>🏆 Ranks</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* BOTTOM CREAM SECTION */}
      <main className="w-full bg-[#EBE7D8] flex-1 py-6 sm:py-8 md:py-10 px-4 sm:px-8 md:px-12 lg:px-16 transition-all duration-300">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-5 sm:space-y-6 md:space-y-7">
          {/* TAB 1: DAY VIEW */}
          {activeTab === 'Day' && (
            <div className="space-y-5 sm:space-y-6 md:space-y-7 animate-fadeIn">
              {/* Date Navigator */}
              <div className="flex items-center justify-between text-xs sm:text-base md:text-lg font-bold text-gray-400 px-1 sm:px-2">
                <button
                  type="button"
                  onClick={() => changeDay(-1)}
                  className="px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
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
                  <span className="text-sm sm:text-base md:text-xl font-black text-[#F25C3B] bg-white/90 px-4 sm:px-6 md:px-8 py-1 sm:py-2 rounded-full shadow-xs">
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
                  className="px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded-full hover:bg-black/5 hover:text-gray-900 transition cursor-pointer"
                >
                  {formatDateShort(nextDate)}
                </button>
              </div>

              {/* Milestone Banner */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 shadow-xs border border-gray-200/70 flex items-center justify-between hover:shadow-md transition">
                <div className="flex items-center space-x-4 sm:space-x-6">
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
                    <p className="text-xs sm:text-sm md:text-base text-gray-400 flex items-center gap-1.5 mt-1.5">
                      👥 <span>24 Cohort Learners Active</span>
                    </p>
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

              {/* Tasks List */}
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
                  currentTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      role="button"
                      tabIndex={0}
                      className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] group ${
                        task.status === 'DONE'
                          ? 'bg-[#E5E1D3] shadow-xs'
                          : 'bg-white shadow-xs hover:bg-gray-50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5 sm:space-x-5 flex-1 min-w-0 pr-2">
                        <span className="text-xs sm:text-base md:text-lg font-bold text-gray-500 w-14 sm:w-18 md:w-22 shrink-0">
                          {task.time}
                        </span>
                        <div className="truncate">
                          <p
                            className={`text-xs sm:text-base md:text-lg font-bold transition-all truncate ${
                              task.status === 'DONE' ? 'text-gray-600 line-through opacity-80' : 'text-gray-950'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center space-x-2 text-[11px] sm:text-xs md:text-sm text-gray-400 mt-0.5">
                            <span>{task.category}</span>
                            {task.isRecurring && (
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                🔁 {task.recurringType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Quick Edit and Delete buttons on hover */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(task, e)}
                          title="Edit Task"
                          className="opacity-60 group-hover:opacity-100 p-1.5 sm:p-2 rounded-full hover:bg-gray-200 text-gray-600 transition cursor-pointer"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          title="Delete Task"
                          className="opacity-60 group-hover:opacity-100 p-1.5 sm:p-2 rounded-full hover:bg-red-100 text-red-600 transition cursor-pointer"
                        >
                          🗑️
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(task.id);
                          }}
                          className={`cursor-pointer transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm font-black px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full shadow-xs ${
                            task.status === 'DONE'
                              ? 'bg-[#18191B] hover:bg-black text-white'
                              : 'bg-[#DFDACB] hover:bg-[#D0CAB9] text-gray-800'
                          }`}
                        >
                          {task.status === 'DONE' ? '✓ DONE' : '○ PENDING'}
                        </button>
                      </div>
                    </div>
                  ))
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
                    className={`flex flex-col items-center p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl transition cursor-pointer ${
                      w.isSelected ? 'bg-[#F25C3B] text-white shadow-xs' : 'text-gray-800 hover:bg-gray-100'
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

              {/* Weekly Schedule Slots */}
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

                {currentTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    role="button"
                    tabIndex={0}
                    className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] group ${
                      task.status === 'DONE'
                        ? 'bg-[#E5E1D3] shadow-xs'
                        : 'bg-white shadow-xs hover:bg-gray-50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 sm:space-x-5 flex-1 min-w-0 pr-2">
                      <span className="text-xs sm:text-base md:text-lg font-bold text-gray-500 w-14 sm:w-18 md:w-22 shrink-0">
                        {task.time}
                      </span>
                      <div className="truncate">
                        <p
                          className={`text-xs sm:text-base md:text-lg font-bold transition-all truncate ${
                            task.status === 'DONE' ? 'text-gray-600 line-through opacity-80' : 'text-gray-950'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-[11px] sm:text-xs md:text-sm text-gray-400 mt-0.5">
                          {task.time} • {task.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(task, e)}
                        title="Edit Task"
                        className="opacity-60 group-hover:opacity-100 p-1.5 sm:p-2 rounded-full hover:bg-gray-200 text-gray-600 transition cursor-pointer"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        title="Delete Task"
                        className="opacity-60 group-hover:opacity-100 p-1.5 sm:p-2 rounded-full hover:bg-red-100 text-red-600 transition cursor-pointer"
                      >
                        🗑️
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(task.id);
                        }}
                        className={`cursor-pointer transition-all active:scale-95 text-[10px] sm:text-xs md:text-sm font-black px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full shadow-xs ${
                          task.status === 'DONE'
                            ? 'bg-[#18191B] hover:bg-black text-white'
                            : 'bg-[#DFDACB] hover:bg-[#D0CAB9] text-gray-800'
                        }`}
                      >
                        {task.status === 'DONE' ? '✓ DONE' : '○ PENDING'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MONTH VIEW */}
          {activeTab === 'Month' && (
            <div className="space-y-5 sm:space-y-6 md:space-y-7 animate-fadeIn">
              {/* Month Navigator */}
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
                    {MONTHS_SHORT[currentDate.getMonth()]} {currentDate.getFullYear()}
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

              {/* Month Grid */}
              <div className="bg-white/90 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs space-y-3 sm:space-y-4">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs md:text-sm font-black text-gray-400">
                  <span>MO</span>
                  <span>TU</span>
                  <span>WE</span>
                  <span>TH</span>
                  <span>FR</span>
                  <span>SA</span>
                  <span>SU</span>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 md:gap-3.5 text-center">
                  {monthDaysList.map((d) => {
                    const mDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                    const mKey = formatDateKey(mDate);
                    const mTasks = scheduleStore[mKey] || [];
                    const isActive = mTasks.some((t) => t.status === 'DONE');
                    const isSelected = d === currentDate.getDate();
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => {
                          const updated = new Date(currentDate);
                          updated.setDate(d);
                          setCurrentDate(updated);
                          setActiveTab('Day');
                        }}
                        className={`h-8 sm:h-11 md:h-14 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-xs sm:text-base md:text-lg font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#F25C3B] text-white shadow-xs'
                            : isActive
                            ? 'bg-[#FCECE7] text-[#F25C3B] hover:bg-[#F25C3B] hover:text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <span>{d}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Stats Summary Card */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-200 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-xs sm:text-base md:text-lg font-bold text-gray-900">Monthly Habit Total</p>
                  <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-0.5">
                    {activeMonthDaysCount} / {daysInCurrentMonth} Active Days • Rank #14
                  </p>
                </div>
                <span className="text-xs sm:text-base md:text-lg font-black text-[#F25C3B] bg-[#FCECE7] px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full">
                  {1200 + activeMonthDaysCount * 30 + pointsBonus} PTS
                </span>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-4 sm:pt-6">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] active:scale-[0.98] text-white font-bold py-4 sm:py-5 md:py-6 px-6 rounded-2xl sm:rounded-3xl shadow-lg transition duration-200 cursor-pointer text-sm sm:text-base md:text-xl flex items-center justify-center space-x-2"
            >
              <span>+ Add Learning Task</span>
            </button>
          </div>
        </div>
      </main>

      {/* CREATE / EDIT TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white text-gray-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {editingTaskId ? 'Edit Learning Task' : 'Add New Task'}
              </h2>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="text-gray-400 hover:text-gray-800 text-2xl p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="bg-red-50 text-red-700 text-xs sm:text-sm p-3 rounded-xl border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics: Electromagnetic Induction Practice"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Complete 15 objective questions and revision notes"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F25C3B] cursor-pointer"
                  >
                    <option value="Core Concept">Core Concept</option>
                    <option value="Quiz Practice">Quiz Practice</option>
                    <option value="Daily Task">Daily Task</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Revision">Revision</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 9 AM or 4:30 PM"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">Recurrence Engine</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                  {[
                    { id: 'daily', label: 'Every Day' },
                    { id: 'weekdays', label: 'Weekdays' },
                    { id: 'custom', label: 'Custom Days' },
                    { id: 'none', label: 'This Day Only' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setModalRecurrenceType(r.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        modalRecurrenceType === r.id
                          ? 'bg-[#F25C3B] text-white border-[#F25C3B] shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {modalRecurrenceType === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Active Days of Week</label>
                  <div className="flex items-center justify-between gap-1">
                    {[
                      { num: 1, label: 'Mon' },
                      { num: 2, label: 'Tue' },
                      { num: 3, label: 'Wed' },
                      { num: 4, label: 'Thu' },
                      { num: 5, label: 'Fri' },
                      { num: 6, label: 'Sat' },
                      { num: 0, label: 'Sun' },
                    ].map((d) => (
                      <button
                        type="button"
                        key={d.num}
                        onClick={() => toggleCustomDay(d.num)}
                        className={`w-10 h-10 rounded-full font-black text-xs transition cursor-pointer ${
                          modalCustomDays.includes(d.num)
                            ? 'bg-[#F25C3B] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="w-1/3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="w-2/3 py-3 bg-[#F25C3B] hover:bg-[#E04B2A] text-white font-bold rounded-xl text-sm shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? 'Saving...' : editingTaskId ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTINGS DRAWER OVERLAY */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#18191B]/95 z-50 p-6 sm:p-10 md:p-14 flex flex-col justify-between text-white animate-fadeIn">
          <div className="max-w-xl md:max-w-2xl mx-auto w-full space-y-6 sm:space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 sm:pb-6">
              <div className="flex items-center space-x-3">
                <svg className="w-6 sm:w-8 h-6 sm:h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
                </svg>
                <span className="text-base sm:text-xl font-bold">byjus streak</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white text-2xl sm:text-3xl p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Your Settings</h2>
              <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-1">View or edit your app settings:</p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="p-4 sm:p-6 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer transition">
                <div>
                  <p className="text-sm sm:text-base md:text-lg font-bold">Account Settings</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{user?.email}</p>
                </div>
                <span className="text-gray-400 text-lg sm:text-xl">›</span>
              </div>

              <div
                onClick={() => {
                  setShowSettings(false);
                  handleNavigate('/leaderboard', 'Opening Leaderboard...');
                }}
                className="p-4 sm:p-6 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer transition"
              >
                <div>
                  <p className="text-sm sm:text-base md:text-lg font-bold">Leaderboard & Cohort</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Rank #14 • {290 + pointsBonus} Points</p>
                </div>
                <span className="text-gray-400 text-lg sm:text-xl">›</span>
              </div>
            </div>
          </div>

          <div className="max-w-xl md:max-w-2xl mx-auto w-full pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-2xl sm:rounded-3xl transition cursor-pointer text-sm sm:text-base"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
