import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, logout, subscribeToAuthState, type BackendUser } from '../services/auth';
import { fetchDateCompletions, toggleTaskCompletion } from '../services/task';
import ScreenLoader from '../components/ScreenLoader';

interface Task {
  id: string;
  time: string;
  title: string;
  category: string;
  status: 'DONE' | 'PENDING';
}

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

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

const SUBJECT_TOPICS: Record<number, { math: string; physics: string; chem: string; test: string }> = {
  0: { math: 'Calculus: Derivatives & Limits', physics: 'Kinematics & Motion Speed Quiz', chem: 'Organic Chemistry Reactions', test: 'Weekly Grand Mock Assessment' },
  1: { math: 'Algebra: Polynomials & Factors', physics: 'Thermodynamics Daily Quiz', chem: 'Inorganic Chemistry Notes', test: 'Unit Review Practice Test' },
  2: { math: 'Trigonometry & Complex Numbers', physics: 'Electromagnetism Practice Test', chem: 'Chemical Bonding Notes', test: 'Mid-Week Speed Assessment' },
  3: { math: 'Vectors & 3D Geometry', physics: 'Optics & Wave Motion Quiz', chem: 'Coordination Compounds Lab', test: 'Concept Mastery Test' },
  4: { math: 'Probability & Statistics', physics: 'Modern Physics Quiz', chem: 'Environmental Chemistry Task', test: 'Weekly Grand Assessment' },
  5: { math: 'Coordinate Geometry Practice', physics: 'Rotational Dynamics Quiz', chem: 'Electrochemistry Lab Notes', test: 'Weekend Milestone Test' },
  6: { math: 'Differential Equations', physics: 'Gravitation & Satellite Motion', chem: 'Hydrocarbons Assignment', test: 'Grand Revision Assessment' },
};

const getInitialTasksForDate = (date: Date): Task[] => {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const key = formatDateKey(date);
  const topic = SUBJECT_TOPICS[Math.abs(day) % 7];

  // Default: Only 9 Dec 2024 has 2 sample completed tasks for initial demo; all other dates default to PENDING
  const isDefaultDemoDay = year === 2024 && month === 11 && day === 9;

  return [
    {
      id: `${key}-1`,
      time: '9 AM',
      title: topic.math,
      category: 'Core Concept',
      status: isDefaultDemoDay ? 'DONE' : 'PENDING',
    },
    {
      id: `${key}-2`,
      time: '10 AM',
      title: topic.physics,
      category: 'Quiz Practice',
      status: isDefaultDemoDay ? 'DONE' : 'PENDING',
    },
    {
      id: `${key}-3`,
      time: '11 AM',
      title: topic.chem,
      category: 'Daily Task',
      status: 'PENDING',
    },
    {
      id: `${key}-4`,
      time: '12 PM',
      title: topic.test,
      category: 'Assessment',
      status: 'PENDING',
    },
  ];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navMessage, setNavMessage] = useState('Loading...');
  const [activeTab, setActiveTab] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [showSettings, setShowSettings] = useState(false);

  // Dynamic Full Date State (Default: Dec 9, 2024)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2024, 11, 9));
  const [scheduleStore, setScheduleStore] = useState<Record<string, Task[]>>({});

  const [streakBonus, setStreakBonus] = useState(0);
  const [pointsBonus, setPointsBonus] = useState(0);

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

  // Load Date-Specific Completions from Backend
  const dateKey = formatDateKey(currentDate);

  useEffect(() => {
    let isCurrent = true;

    async function loadCompletions() {
      try {
        const serverCompletions = await fetchDateCompletions(dateKey);
        if (!isCurrent) return;

        if (serverCompletions && Object.keys(serverCompletions).length > 0) {
          const initial = getInitialTasksForDate(currentDate);
          const updated: Task[] = initial.map(t => {
            if (serverCompletions[t.id] !== undefined) {
              return { ...t, status: (serverCompletions[t.id] ? 'DONE' : 'PENDING') as 'DONE' | 'PENDING' };
            }
            return t;
          });

          setScheduleStore(prev => ({
            ...prev,
            [dateKey]: updated
          }));
        }
      } catch (err) {
        console.error('Failed to load date completions:', err);
      }
    }

    loadCompletions();

    return () => {
      isCurrent = false;
    };
  }, [dateKey, currentDate]);

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

  const currentTasks = scheduleStore[dateKey] || getInitialTasksForDate(currentDate);

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

  // Week View Calculations & Navigation (1-7, 8-14, 15-21, 22-28, 29-31 date block grouping)
  const getWeekBlockData = (baseDate: Date, blockOffset = 0) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    const blockIndex = Math.floor((day - 1) / 7);
    let targetYear = year;
    let targetMonth = month;
    let targetBlockIndex = blockIndex + blockOffset;

    // Handle backward transition across months
    while (targetBlockIndex < 0) {
      targetMonth -= 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
      const daysInPrev = new Date(targetYear, targetMonth + 1, 0).getDate();
      const maxPrevBlock = Math.floor((daysInPrev - 1) / 7);
      targetBlockIndex += (maxPrevBlock + 1);
    }

    // Handle forward transition across months
    while (true) {
      const daysInCur = new Date(targetYear, targetMonth + 1, 0).getDate();
      const maxCurBlock = Math.floor((daysInCur - 1) / 7);
      if (targetBlockIndex <= maxCurBlock) {
        break;
      }
      targetBlockIndex -= (maxCurBlock + 1);
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const startDay = targetBlockIndex * 7 + 1;
    const endDay = Math.min((targetBlockIndex + 1) * 7, daysInTargetMonth);

    const days = [];
    const DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    for (let d = startDay; d <= endDay; d++) {
      const cur = new Date(targetYear, targetMonth, d);
      const curKey = formatDateKey(cur);
      const dayTasks = scheduleStore[curKey] || getInitialTasksForDate(cur);
      const hasCompleted = dayTasks.some(t => t.status === 'DONE');
      const isSelected =
        cur.getDate() === currentDate.getDate() &&
        cur.getMonth() === currentDate.getMonth() &&
        cur.getFullYear() === currentDate.getFullYear();

      days.push({
        dayName: DAY_NAMES[cur.getDay()],
        date: cur,
        dateNum: d,
        monthName: MONTHS_SHORT[cur.getMonth()],
        active: hasCompleted,
        isSelected,
      });
    }

    const monthLabel = MONTHS_SHORT[targetMonth];
    const label = `${startDay}-${endDay} ${monthLabel}`;

    return {
      year: targetYear,
      month: targetMonth,
      startDay,
      endDay,
      days,
      label,
      firstDate: new Date(targetYear, targetMonth, startDay),
    };
  };

  const currentWeek = getWeekBlockData(currentDate, 0);
  const prevWeek = getWeekBlockData(currentDate, -1);
  const nextWeek = getWeekBlockData(currentDate, 1);

  const changeWeek = (deltaBlocks: number) => {
    if (deltaBlocks === -1) {
      setCurrentDate(prevWeek.firstDate);
    } else if (deltaBlocks === 1) {
      setCurrentDate(nextWeek.firstDate);
    }
  };

  // Month View Calculations & Navigation
  const changeMonth = (deltaMonths: number) => {
    const updated = new Date(currentDate);
    updated.setMonth(currentDate.getMonth() + deltaMonths);
    setCurrentDate(updated);
  };

  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthDaysList = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  // Active streak days in current month based on scheduleStore
  const activeMonthDaysCount = monthDaysList.filter(d => {
    const mDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
    const mKey = formatDateKey(mDate);
    const mTasks = scheduleStore[mKey] || getInitialTasksForDate(mDate);
    return mTasks.some(t => t.status === 'DONE');
  }).length;

  const handleContinueLearning = async () => {
    const baseTasks = scheduleStore[dateKey] || getInitialTasksForDate(currentDate);
    const nextPendingIndex = baseTasks.findIndex(t => t.status === 'PENDING');
    if (nextPendingIndex !== -1) {
      const targetTask = baseTasks[nextPendingIndex];
      const updatedTasks: Task[] = baseTasks.map((t, idx) =>
        idx === nextPendingIndex ? { ...t, status: 'DONE' } : t
      );
      setScheduleStore(prev => ({ ...prev, [dateKey]: updatedTasks }));

      try {
        const response = await toggleTaskCompletion(targetTask.id, dateKey, true);
        if (response && response.pointsAwarded > 0) {
          setPointsBonus(prev => prev + response.pointsAwarded);
          setStreakBonus(1);
        } else {
          setPointsBonus(prev => prev + 15);
          setStreakBonus(1);
        }
      } catch (err) {
        console.error('Failed to sync continue learning with backend:', err);
        setPointsBonus(prev => prev + 15);
        setStreakBonus(1);
      }
    }
  };

  const toggleTask = async (taskId: string) => {
    const baseTasks = scheduleStore[dateKey] || getInitialTasksForDate(currentDate);
    const targetTask = baseTasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const nextStatus = targetTask.status === 'DONE' ? 'PENDING' : 'DONE';
    const isCompleted = nextStatus === 'DONE';

    // 1. Optimistic UI update strictly for this date
    const updatedTasks: Task[] = baseTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: nextStatus as 'DONE' | 'PENDING' };
      }
      return t;
    });
    setScheduleStore(prev => ({ ...prev, [dateKey]: updatedTasks }));

    // 2. Persist to backend database for (userId, taskId, dateKey)
    try {
      const response = await toggleTaskCompletion(taskId, dateKey, isCompleted);
      if (response && response.pointsAwarded > 0) {
        setPointsBonus(prev => prev + response.pointsAwarded);
        setStreakBonus(1);
      }
    } catch (err) {
      console.error('Failed to sync task toggle with backend:', err);
    }
  };

  const completedCount = currentTasks.filter(t => t.status === 'DONE').length;
  const rawName = user?.name || (user?.email ? user.email.split('@')[0] : 'Damir');
  const firstWord = rawName.trim().split(/\s+/)[0] || 'Damir';
  const displayName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

  const baseStreak = typeof user?.latestStreak === 'object' && user?.latestStreak !== null && 'streakCount' in user.latestStreak
    ? Number((user.latestStreak as { streakCount?: number }).streakCount) || 15
    : 15;

  const currentStreak = baseStreak + streakBonus;

  if (loading || isNavigating) {
    return <ScreenLoader message={isNavigating ? navMessage : "Loading your schedule..."} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#18191B] flex flex-col justify-between font-sans text-gray-100 select-none animate-screen">
      
      {/* TOP DARK SECTION (Full Width with Centered Responsive Container) */}
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
                View your generated learning schedule:
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 sm:p-3 hover:bg-white/10 rounded-xl sm:rounded-2xl transition cursor-pointer text-gray-300"
            >
              <svg className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Filter Pills (Day / Week / Month) & Leaderboard Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-black/30 p-1 sm:p-1.5 md:p-2 rounded-full border border-white/5">
              {(['Day', 'Week', 'Month'] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 sm:px-5 md:px-7 py-1.5 sm:py-2 md:py-2.5 rounded-full text-xs sm:text-sm md:text-base font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[#F25C3B] text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('/leaderboard', 'Opening Leaderboard...')}
              className="px-3.5 sm:px-5 md:px-7 py-1.5 sm:py-2 md:py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 rounded-full transition cursor-pointer flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base font-bold shadow-xs"
            >
              <span className="text-sm sm:text-base md:text-lg">🏆</span>
              <span>Leaderboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* BOTTOM CREAM SHEET (Full Width with Centered Responsive Container) */}
      <main className="w-full flex-1 bg-[#EFECE1] text-gray-900 rounded-t-[32px] sm:rounded-t-[40px] md:rounded-t-[48px] px-4 sm:px-8 md:px-12 lg:px-16 py-6 sm:py-8 md:py-10 shadow-inner flex flex-col justify-between">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between space-y-6 sm:space-y-8">
          
          {/* TAB 1: DAY VIEW */}
          {activeTab === 'Day' && (
            <div className="space-y-5 sm:space-y-6 md:space-y-7 animate-fadeIn">
              {/* Functional Date Calendar Navigator */}
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

              {/* Active Milestone Card */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 shadow-xs border border-gray-200/70 flex items-center justify-between hover:shadow-md transition">
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <div className="w-12 sm:w-16 md:w-20 h-14 sm:h-18 md:h-22 bg-[#F25C3B] text-white rounded-xl sm:rounded-2xl flex flex-col items-center justify-center shadow-xs">
                    <span className="text-base sm:text-xl md:text-3xl font-black leading-none">{currentStreak}</span>
                    <span className="text-[9px] sm:text-xs md:text-sm font-bold uppercase tracking-tight mt-0.5">DAYS</span>
                    <span className="text-[8px] sm:text-[10px] md:text-xs opacity-80 mt-0.5">🔥 STREAK</span>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900">Daily Study Milestone</h3>
                    <p className="text-xs sm:text-base md:text-lg text-gray-500 mt-0.5">Progress: {completedCount}/{currentTasks.length} Completed</p>
                    <p className="text-xs sm:text-sm md:text-base text-gray-400 flex items-center gap-1.5 mt-1.5">
                      👥 <span>24 Cohort Learners Active</span>
                    </p>
                  </div>
                </div>

                <div className="text-gray-400 text-xl sm:text-2xl md:text-3xl font-bold pr-2">›</div>
              </div>

              {/* Schedule Slots */}
              <div className="space-y-3 sm:space-y-4 pt-1">
                {currentTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    role="button"
                    tabIndex={0}
                    className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] ${
                      task.status === 'DONE'
                        ? 'bg-[#E5E1D3] shadow-xs'
                        : 'bg-white shadow-xs hover:bg-gray-50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 sm:space-x-5">
                      <span className="text-xs sm:text-base md:text-lg font-bold text-gray-500 w-14 sm:w-18 md:w-22">{task.time}</span>
                      <div>
                        <p className={`text-xs sm:text-base md:text-lg font-bold transition-all ${task.status === 'DONE' ? 'text-gray-600 line-through opacity-80' : 'text-gray-950'}`}>
                          {task.title}
                        </p>
                        <p className="text-[11px] sm:text-xs md:text-sm text-gray-400 mt-0.5">{task.category}</p>
                      </div>
                    </div>

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
                ))}
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
                    <span className={`w-1.5 sm:w-2 md:w-2.5 h-1.5 sm:h-2 md:h-2.5 rounded-full mt-1.5 ${w.active ? (w.isSelected ? 'bg-white' : 'bg-[#F25C3B]') : 'bg-gray-300'}`}></span>
                  </button>
                ))}
              </div>

              {/* Weekly Schedule Slots for Selected Day */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs sm:text-base md:text-lg font-bold text-gray-700">
                    Schedule for {formatDateShort(currentDate)}
                  </span>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#F25C3B] bg-white/80 px-3 sm:px-4 py-1 rounded-full shadow-xs">
                    {completedCount}/{currentTasks.length} Completed
                  </span>
                </div>

                {currentTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    role="button"
                    tabIndex={0}
                    className={`p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] ${
                      task.status === 'DONE'
                        ? 'bg-[#E5E1D3] shadow-xs'
                        : 'bg-white shadow-xs hover:bg-gray-50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 sm:space-x-5">
                      <span className="text-xs sm:text-base md:text-lg font-bold text-gray-500 w-14 sm:w-18 md:w-22">{task.time}</span>
                      <div>
                        <p className={`text-xs sm:text-base md:text-lg font-bold transition-all ${task.status === 'DONE' ? 'text-gray-600 line-through opacity-80' : 'text-gray-950'}`}>
                          {task.title}
                        </p>
                        <p className="text-[11px] sm:text-xs md:text-sm text-gray-400 mt-0.5">{task.time} • {task.category}</p>
                      </div>
                    </div>

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
                    const mTasks = scheduleStore[mKey] || getInitialTasksForDate(mDate);
                    const isActive = mTasks.some(t => t.status === 'DONE');
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
                  <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-0.5">{activeMonthDaysCount} / {daysInCurrentMonth} Active Days • Rank #14</p>
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
              onClick={handleContinueLearning}
              className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] active:scale-[0.98] text-white font-bold py-4 sm:py-5 md:py-6 px-6 rounded-2xl sm:rounded-3xl shadow-lg transition duration-200 cursor-pointer text-sm sm:text-base md:text-xl"
            >
              Continue Learning
            </button>
          </div>
        </div>
      </main>

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
                onClick={() => { setShowSettings(false); handleNavigate('/leaderboard', 'Opening Leaderboard...'); }}
                className="p-4 sm:p-6 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer transition"
              >
                <div>
                  <p className="text-sm sm:text-base md:text-lg font-bold">Leaderboard & Cohort</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Rank #14 • {290 + pointsBonus} Points</p>
                </div>
                <span className="text-gray-400 text-lg sm:text-xl">›</span>
              </div>

              <div className="p-4 sm:p-6 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-3xl flex items-center justify-between cursor-pointer transition">
                <div>
                  <p className="text-sm sm:text-base md:text-lg font-bold">Streak Notifications</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Daily 8 PM reminder enabled</p>
                </div>
                <span className="text-gray-400 text-lg sm:text-xl">›</span>
              </div>
            </div>
          </div>

          <div className="max-w-xl md:max-w-2xl mx-auto w-full space-y-3">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] text-white font-bold py-4 sm:py-5 rounded-2xl sm:rounded-3xl shadow-md cursor-pointer text-sm sm:text-base md:text-lg"
            >
              Sign Out
            </button>
            <p className="text-xs sm:text-sm text-gray-500 text-center">We're here for your daily habits 24/7.</p>
          </div>
        </div>
      )}

    </div>
  );
}
