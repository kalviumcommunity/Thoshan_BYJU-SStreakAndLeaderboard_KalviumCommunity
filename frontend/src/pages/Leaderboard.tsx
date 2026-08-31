import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAuthState, type BackendUser } from '../services/auth';
import {
  fetchLeaderboard,
  refreshLeaderboardApi,
  type PodiumLearner,
  type RankedLearner,
  type LeaderboardResponse,
} from '../services/leaderboard';
import ScreenLoader from '../components/ScreenLoader';

const PAGE_SIZE = 15;

export default function Leaderboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navMessage, setNavMessage] = useState('Loading...');
  const [activeTab, setActiveTab] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [liveLeaderboardStore, setLiveLeaderboardStore] = useState<Record<string, LeaderboardResponse>>({});
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch live API leaderboard data on tab change or retry
  const loadLeaderboardData = useCallback(async () => {
    setLeaderboardLoading(true);
    setFetchError(null);
    const tf = activeTab.toLowerCase() as 'day' | 'week' | 'month';
    try {
      const data = await fetchLeaderboard(tf);
      if (data && data.success) {
        setLiveLeaderboardStore((prev) => ({
          ...prev,
          [activeTab]: data,
        }));
      } else {
        setFetchError('Unable to load leaderboard. Please try again.');
      }
    } catch {
      setFetchError('Unable to load leaderboard. Please check your connection and retry.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // Reset pagination to Page 1 on timeframe tab change
    setCurrentPage(1);
    loadLeaderboardData();
  }, [activeTab, loadLeaderboardData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const tf = activeTab.toLowerCase() as 'day' | 'week' | 'month';
      await refreshLeaderboardApi(tf);
      await loadLeaderboardData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToAuthState((authUser) => {
      if (authUser) {
        if (isMounted) {
          setCurrentUser(authUser);
          setLoading(false);
        }
      } else {
        if (isMounted) {
          navigate('/login', { replace: true });
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const handleNavigate = (path: string, msg: string) => {
    setIsNavigating(true);
    setNavMessage(msg);
    setTimeout(() => {
      navigate(path);
    }, 280);
  };

  const rawName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Learner');
  const firstWord = rawName.trim().split(/\s+/)[0] || 'Learner';
  const displayName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

  const activeLive = liveLeaderboardStore[activeTab];
  const podiumList: PodiumLearner[] = activeLive?.podium || [];

  // Unified global ranked list (ranks 1..N)
  const fullLeaderboardList: RankedLearner[] = useMemo(() => {
    if (activeLive?.allRanks && activeLive.allRanks.length > 0) {
      return activeLive.allRanks;
    }
    const podiumAsRanked: RankedLearner[] = (activeLive?.podium || []).map((p) => ({
      rank: p.rank,
      userId: p.userId,
      name: p.name,
      points: p.points,
      streak: p.streak,
      status: 'GOING',
    }));
    return [...podiumAsRanked, ...(activeLive?.rankings || [])];
  }, [activeLive]);

  const totalLearners = activeLive?.totalLearners || fullLeaderboardList.length;
  const totalPages = Math.max(1, Math.ceil(totalLearners / PAGE_SIZE));

  // Current page 15-learner slice based on actual global ranks
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedRankings = useMemo(() => {
    return fullLeaderboardList.slice(startIndex, endIndex);
  }, [fullLeaderboardList, startIndex, endIndex]);

  const userRank = activeLive?.userStanding?.userRank || 0;
  const userPoints = activeLive?.userStanding?.userPoints ?? 0;
  const userStreak = activeLive?.userStanding?.userStreak ?? 0;
  const periodLabel = activeLive?.periodLabel || `${activeTab} Cohort Standings`;

  // Navigate directly to the page containing current user's global rank
  const handleJumpToMyRank = () => {
    if (!userRank || userRank <= 0) return;
    const targetPage = Math.max(1, Math.min(totalPages, Math.ceil(userRank / PAGE_SIZE)));
    setCurrentPage(targetPage);

    // Smooth scroll to the user's row or rankings list
    setTimeout(() => {
      const userRow = document.getElementById(`rank-row-${userRank}`);
      if (userRow) {
        userRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const listEl = document.getElementById('cohort-rankings-section');
        listEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  if (loading || isNavigating) {
    return <ScreenLoader message={isNavigating ? navMessage : 'Fetching cohort standings...'} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#18191B] flex flex-col justify-between font-sans text-gray-100 select-none animate-screen">
      {/* TOP HEADER SECTION */}
      <header className="w-full bg-[#18191B] pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 px-4 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleNavigate('/dashboard', 'Returning to your schedule...')}
              className="flex items-center space-x-1 sm:space-x-2 text-white/90 hover:text-white transition cursor-pointer"
            >
              <svg className="w-5 sm:w-6 h-5 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs sm:text-base font-bold">Schedule</span>
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-base font-black tracking-tight text-white/90">byjus streak</span>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing || leaderboardLoading}
                title="Refresh Live Standings"
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="20px"
                  viewBox="0 -960 960 960"
                  width="20px"
                  fill="#e3e3e3"
                  className={refreshing || leaderboardLoading ? 'animate-spin' : ''}
                >
                  <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title & Subtext */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                Cohort Leaderboard
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-1">
                {periodLabel} • {totalLearners} Active Learners
              </p>
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-gray-400 font-semibold">Active Learner</span>
              <span className="text-sm md:text-base font-bold text-white">{displayName}</span>
            </div>
          </div>

          {/* Timeframe Selector Pills */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-black/30 p-1 sm:p-1.5 rounded-full border border-white/5 w-fit">
            {(['Day', 'Week', 'Month'] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 md:px-8 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm md:text-base font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-md transform scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN CREAM CONTENT AREA */}
      <main className="flex-1 bg-[#EFECE1] rounded-t-[32px] sm:rounded-t-[48px] px-4 sm:px-8 md:px-12 lg:px-16 pt-5 sm:pt-7 pb-12 text-gray-900 shadow-2xl">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Error Banner */}
          {fetchError && (
            <div className="bg-red-100 border border-red-300 text-red-800 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-3">
                <span className="text-xl">⚠️</span>
                <span className="text-xs sm:text-sm font-semibold">{fetchError}</span>
              </div>
              <button
                type="button"
                onClick={loadLeaderboardData}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-full transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {leaderboardLoading ? (
            <div className="space-y-4 sm:space-y-6 animate-pulse">
              {/* Podium Skeleton */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-6 pt-1">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white/70 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center border border-gray-200 flex flex-col items-center justify-between h-36 sm:h-44"
                  >
                    <div className="w-8 h-3 bg-gray-200 rounded-full mb-2"></div>
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-200"></div>
                    <div className="w-16 sm:w-24 h-3 bg-gray-200 rounded-full mt-2"></div>
                    <div className="w-10 h-3 bg-gray-200 rounded-full mt-1"></div>
                  </div>
                ))}
              </div>

              {/* Your Rank Skeleton */}
              <div className="bg-white/70 border border-gray-200 p-4 sm:p-5 rounded-2xl sm:rounded-3xl h-20"></div>

              {/* List Skeleton */}
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white/70 border border-gray-200 p-4 sm:p-5 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-6 h-4 bg-gray-200 rounded"></div>
                      <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                      <div className="w-28 sm:w-40 h-4 bg-gray-200 rounded"></div>
                    </div>
                    <div className="w-16 h-4 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* 1. TOP 3 PODIUM CARDS */}
              {podiumList.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-6 pt-1">
                  {podiumList.map((learner) => {
                    const initial = ((learner.name || 'Learner').trim().charAt(0) || 'L').toUpperCase();
                    const podiumAvatarClass =
                      learner.rank === 1
                        ? 'bg-amber-400 text-gray-950 ring-2 ring-amber-300/60 shadow-amber-400/30'
                        : learner.rank === 2
                        ? 'bg-[#F25C3B] text-white ring-2 ring-[#F25C3B]/60 shadow-[#F25C3B]/30'
                        : 'bg-[#C26D2B] text-white ring-2 ring-[#C26D2B]/60 shadow-[#C26D2B]/30';

                    return (
                      <div
                        key={learner.rank}
                        className={`bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 text-center border shadow-xs flex flex-col items-center justify-between hover:shadow-md transition ${
                          learner.rank === 1 ? 'border-amber-300 ring-2 sm:ring-4 ring-amber-300/40' : 'border-gray-200/80'
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs md:text-sm font-black text-gray-500">{learner.badge}</span>
                        <div
                          className={`w-10 sm:w-14 md:w-18 h-10 sm:h-14 md:h-18 rounded-full ${podiumAvatarClass} font-black text-xs sm:text-base md:text-xl flex items-center justify-center shadow-md my-1.5 sm:my-2.5`}
                        >
                          {initial}
                        </div>
                        <p className="text-xs sm:text-base md:text-lg font-bold text-gray-900 truncate w-full">
                          {learner.name}
                        </p>
                        <p className="text-[10px] sm:text-xs md:text-base font-black text-[#F25C3B] mt-0.5 sm:mt-1">
                          {learner.points} pts
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. DEDICATED "YOUR RANK" SHORTCUT ELEMENT (Directly Below Top 3) */}
              {userRank > 0 && (
                <div className="bg-[#18191B] text-white p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center space-x-3.5 sm:space-x-5">
                    <div className="flex flex-col items-center justify-center bg-[#F25C3B] text-white rounded-xl sm:rounded-2xl w-12 sm:w-16 h-12 sm:h-16 font-black shadow-md shrink-0">
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-tight opacity-85">RANK</span>
                      <span className="text-base sm:text-xl md:text-2xl leading-none">#{userRank}</span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/15 text-[#F25C3B] px-2 py-0.5 rounded-md">
                          YOUR RANK
                        </span>
                        <span className="text-[10px] sm:text-xs text-amber-400 font-bold">
                          {userStreak} day streak 🔥
                        </span>
                      </div>
                      <p className="text-sm sm:text-base md:text-lg font-bold text-white mt-0.5">
                        {displayName} (You)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-white/10">
                    <span className="text-xs sm:text-sm md:text-base font-black text-[#F25C3B] bg-white/10 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full">
                      {userPoints} PTS
                    </span>

                    <button
                      type="button"
                      onClick={handleJumpToMyRank}
                      className="bg-[#F25C3B] hover:bg-[#E04B2A] text-white px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
                      title="Navigate to the page containing your ranking"
                    >
                      <span>View in Leaderboard →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. PAGINATED LEADERBOARD RANKINGS SECTION */}
              <div id="cohort-rankings-section" className="space-y-3 sm:space-y-4 pt-1">
                {/* Section Header & Page Status */}
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs sm:text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">
                    {activeTab} Cohort Rankings
                  </h2>
                  <span className="text-xs sm:text-sm text-gray-500 font-semibold bg-white/80 px-3 py-1 rounded-full border border-gray-200/80 shadow-xs">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                {/* Empty State when no users on leaderboard */}
                {totalLearners === 0 && !fetchError && (
                  <div className="bg-white/80 border border-gray-200 rounded-2xl sm:rounded-3xl p-8 text-center space-y-2">
                    <span className="text-3xl">🏆</span>
                    <p className="text-sm sm:text-base font-bold text-gray-800">
                      No active learners ranked yet for this period
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Complete your daily learning tasks on the schedule to claim the #1 spot!
                    </p>
                  </div>
                )}

                {/* 15-Learners Paginated List with Global Ranks */}
                {paginatedRankings.length > 0 && (
                  <div id="cohort-rankings-list" className="space-y-2.5 sm:space-y-3">
                    {paginatedRankings.map((item) => {
                      const isCurrentUser = item.userId === currentUser?.id || item.rank === userRank;
                      const initial = ((item.name || 'Learner').trim().charAt(0) || 'L').toUpperCase();

                      return (
                        <div
                          key={item.rank}
                          id={`rank-row-${item.rank}`}
                          className={`p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between transition-all duration-200 ${
                            isCurrentUser
                              ? 'bg-[#18191B] text-white border-2 border-[#F25C3B] shadow-xl ring-2 ring-[#F25C3B]/30'
                              : 'bg-white/85 border border-gray-200/90 text-gray-900 shadow-xs hover:bg-white hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center space-x-3.5 sm:space-x-5">
                            <span
                              className={`text-xs sm:text-base md:text-lg font-black w-7 sm:w-9 md:w-11 ${
                                isCurrentUser ? 'text-[#F25C3B]' : 'text-gray-400'
                              }`}
                            >
                              #{item.rank}
                            </span>

                            <div
                              className={`w-8 sm:w-11 md:w-14 h-8 sm:h-11 md:h-14 rounded-full font-bold text-xs sm:text-base md:text-lg flex items-center justify-center shadow-xs shrink-0 ${
                                isCurrentUser
                                  ? 'bg-[#F25C3B] text-white font-black'
                                  : item.rank === 1
                                  ? 'bg-amber-400 text-gray-950 font-black'
                                  : item.rank === 2
                                  ? 'bg-[#F25C3B] text-white font-black'
                                  : item.rank === 3
                                  ? 'bg-[#C26D2B] text-white font-black'
                                  : 'bg-gray-200 text-gray-800'
                              }`}
                            >
                              {initial}
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <p
                                  className={`text-xs sm:text-base md:text-lg font-bold ${
                                    isCurrentUser ? 'text-white' : 'text-gray-950'
                                  }`}
                                >
                                  {item.name}
                                </p>
                                {isCurrentUser && (
                                  <span className="bg-[#F25C3B] text-white text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wide">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-[10px] sm:text-xs md:text-sm ${
                                  isCurrentUser ? 'text-gray-400' : 'text-gray-500'
                                }`}
                              >
                                {item.streak} day streak
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2.5 sm:space-x-4">
                            <span className="text-xs sm:text-base md:text-lg font-black text-[#F25C3B]">
                              {item.points} pts
                            </span>
                            <span
                              className={`text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full ${
                                isCurrentUser
                                  ? 'bg-white/10 text-amber-400'
                                  : item.status === 'GOING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isCurrentUser ? 'ACTIVE' : item.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div className="bg-white/80 border border-gray-200 p-3 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs mt-4">
                    <p className="text-xs sm:text-sm font-semibold text-gray-500 order-2 sm:order-1 text-center sm:text-left">
                      Showing ranks{' '}
                      <strong className="text-gray-900">
                        {startIndex + 1}–{Math.min(endIndex, totalLearners)}
                      </strong>{' '}
                      of <strong className="text-gray-900">{totalLearners}</strong> learners
                    </p>

                    <div className="flex items-center space-x-1.5 sm:space-x-2 order-1 sm:order-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1 || leaderboardLoading}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs sm:text-sm font-bold text-gray-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                      >
                        ‹ Previous
                      </button>

                      {/* Numeric Page Buttons */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          type="button"
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={leaderboardLoading}
                          className={`w-8 sm:w-10 h-8 sm:h-10 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                            currentPage === pageNum
                              ? 'bg-[#F25C3B] text-white shadow-md'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-xs'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={currentPage >= totalPages || leaderboardLoading}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs sm:text-sm font-bold text-gray-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                      >
                        Next ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
