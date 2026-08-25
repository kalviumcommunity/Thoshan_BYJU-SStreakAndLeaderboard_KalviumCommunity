import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, subscribeToAuthState, type BackendUser } from '../services/auth';
import { fetchLeaderboard, type PodiumLearner, type RankedLearner, type LeaderboardResponse } from '../services/leaderboard';
import ScreenLoader from '../components/ScreenLoader';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navMessage, setNavMessage] = useState('Loading...');
  const [activeTab, setActiveTab] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [liveLeaderboardStore, setLiveLeaderboardStore] = useState<Record<string, LeaderboardResponse>>({});

  // Fetch live API leaderboard data on tab change
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      const tf = activeTab.toLowerCase() as 'day' | 'week' | 'month';
      const data = await fetchLeaderboard(tf);
      if (isMounted && data) {
        setLiveLeaderboardStore((prev) => ({
          ...prev,
          [activeTab]: data,
        }));
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await fetchProfile();
          if (isMounted) {
            setCurrentUser(profile);
            setLoading(false);
          }
        } catch {
          if (isMounted) {
            setCurrentUser({
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

  const rawName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Damir');
  const firstWord = rawName.trim().split(/\s+/)[0] || 'Damir';
  const displayName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

  // Fallback / default baseline datasets
  const fallbackDatasets = {
    Day: {
      periodLabel: 'Today Cohort Standings',
      podium: [
        { rank: 1, name: 'Areeq S.', points: 80, streak: 28, avatarBg: 'bg-amber-400', badge: '🥇 #1' },
        { rank: 2, name: 'Rhea M.', points: 70, streak: 21, avatarBg: 'bg-[#F25C3B]', badge: '🥈 #2' },
        { rank: 3, name: 'Zoya K.', points: 65, streak: 19, avatarBg: 'bg-amber-600', badge: '🥉 #3' },
      ] as PodiumLearner[],
      rankings: [
        { rank: 4, name: 'Meera Nair', points: 60, streak: 16, status: 'GOING' },
        { rank: 5, name: 'Ishaan Verma', points: 55, streak: 14, status: 'GOING' },
        { rank: 6, name: 'Priya Iyer', points: 45, streak: 12, status: 'PENDING' },
        { rank: 7, name: 'David Charles', points: 40, streak: 10, status: 'PENDING' },
      ] as RankedLearner[],
      userRank: 12,
      userPoints: 40,
    },
    Week: {
      periodLabel: 'Weekly Cohort Standings',
      podium: [
        { rank: 1, name: 'Areeq S.', points: 520, streak: 28, avatarBg: 'bg-amber-400', badge: '🥇 #1' },
        { rank: 2, name: 'Rhea M.', points: 410, streak: 21, avatarBg: 'bg-[#F25C3B]', badge: '🥈 #2' },
        { rank: 3, name: 'Zoya K.', points: 365, streak: 19, avatarBg: 'bg-amber-600', badge: '🥉 #3' },
      ] as PodiumLearner[],
      rankings: [
        { rank: 4, name: 'Meera Nair', points: 330, streak: 16, status: 'GOING' },
        { rank: 5, name: 'Ishaan Verma', points: 312, streak: 14, status: 'GOING' },
        { rank: 6, name: 'Priya Iyer', points: 301, streak: 12, status: 'PENDING' },
        { rank: 7, name: 'David Charles', points: 295, streak: 10, status: 'PENDING' },
      ] as RankedLearner[],
      userRank: 14,
      userPoints: 290,
    },
    Month: {
      periodLabel: 'Monthly Champions Standings',
      podium: [
        { rank: 1, name: 'Areeq S.', points: 2150, streak: 28, avatarBg: 'bg-amber-400', badge: '🥇 #1' },
        { rank: 2, name: 'Rhea M.', points: 1890, streak: 21, avatarBg: 'bg-[#F25C3B]', badge: '🥈 #2' },
        { rank: 3, name: 'Zoya K.', points: 1740, streak: 19, avatarBg: 'bg-amber-600', badge: '🥉 #3' },
      ] as PodiumLearner[],
      rankings: [
        { rank: 4, name: 'Meera Nair', points: 1560, streak: 16, status: 'GOING' },
        { rank: 5, name: 'Ishaan Verma', points: 1420, streak: 14, status: 'GOING' },
        { rank: 6, name: 'Priya Iyer', points: 1380, streak: 12, status: 'GOING' },
        { rank: 7, name: 'David Charles', points: 1310, streak: 10, status: 'PENDING' },
      ] as RankedLearner[],
      userRank: 8,
      userPoints: 1280,
    },
  };

  const activeLive = liveLeaderboardStore[activeTab];
  const currentData = activeLive && activeLive.podium && activeLive.podium.length > 0
    ? {
        periodLabel: activeLive.periodLabel,
        podium: activeLive.podium,
        rankings: activeLive.rankings,
        userRank: activeLive.userStanding?.userRank || fallbackDatasets[activeTab].userRank,
        userPoints: activeLive.userStanding?.userPoints !== undefined ? activeLive.userStanding.userPoints : fallbackDatasets[activeTab].userPoints,
      }
    : fallbackDatasets[activeTab];

  if (loading || isNavigating) {
    return <ScreenLoader message={isNavigating ? navMessage : "Fetching cohort standings..."} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#18191B] flex flex-col justify-between font-sans text-gray-100 select-none animate-screen">
      
      {/* TOP DARK SECTION */}
      <header className="w-full bg-[#18191B] pt-4 sm:pt-6 md:pt-8 pb-6 sm:pb-8 md:pb-10 px-4 sm:px-8 md:px-12 lg:px-16">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-7">
          
          {/* Top Status */}
          <div className="flex items-center justify-between text-xs sm:text-sm md:text-base pt-1">
            <button
              type="button"
              onClick={() => handleNavigate('/dashboard', 'Returning to schedule...')}
              className="flex items-center space-x-2 text-white/90 hover:text-white transition cursor-pointer"
            >
              <svg className="w-5 sm:w-6 md:w-7 h-5 sm:h-6 md:h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
              </svg>
              <span className="font-bold tracking-tight sm:text-base md:text-lg">byjus streak</span>
            </button>

            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="text-gray-400 font-medium text-[11px] sm:text-sm md:text-base">Rank #{currentData.userRank}</span>
              <span className="text-sm sm:text-base md:text-lg">🔥</span>
            </div>
          </div>

          {/* Heading */}
          <div className="pt-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              {activeTab === 'Day' ? "Today's Leaderboard" : activeTab === 'Month' ? 'Monthly Champions' : 'Weekly Leaderboard'}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-1 sm:mt-2">
              {currentData.periodLabel} • Cohort Standings:
            </p>
          </div>

          {/* Filter Pills (Day / Week / Month) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-black/30 p-1 sm:p-1.5 md:p-2 rounded-full border border-white/5 w-fit">
            {(['Day', 'Week', 'Month'] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 md:px-7 py-1.5 sm:py-2 md:py-2.5 rounded-full text-xs sm:text-sm md:text-base font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#F25C3B] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* BOTTOM CREAM SHEET */}
      <main className="w-full flex-1 bg-[#EFECE1] text-gray-900 rounded-t-[32px] sm:rounded-t-[40px] md:rounded-t-[48px] px-4 sm:px-8 md:px-12 lg:px-16 py-6 sm:py-8 md:py-10 shadow-inner flex flex-col justify-between">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between space-y-6 sm:space-y-8">
          
          <div className="space-y-5 sm:space-y-6 md:space-y-7">
            
            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-6 pt-1">
              {currentData.podium.map((learner) => (
                <div
                  key={learner.rank}
                  className={`bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 text-center border shadow-xs flex flex-col items-center justify-between hover:shadow-md transition ${
                    learner.rank === 1 ? 'border-amber-300 ring-2 sm:ring-4 ring-amber-300/40' : 'border-gray-200/80'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs md:text-sm font-black text-gray-500">{learner.badge}</span>
                  <div className={`w-10 sm:w-14 md:w-18 h-10 sm:h-14 md:h-18 rounded-full ${learner.avatarBg} text-white font-black text-xs sm:text-base md:text-xl flex items-center justify-center shadow-sm my-1.5 sm:my-2.5`}>
                    {learner.name.charAt(0)}
                  </div>
                  <p className="text-xs sm:text-base md:text-lg font-bold text-gray-900 truncate w-full">{learner.name}</p>
                  <p className="text-[10px] sm:text-xs md:text-base font-black text-[#F25C3B] mt-0.5 sm:mt-1">{learner.points} pts</p>
                </div>
              ))}
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between pt-1">
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">
                {activeTab} Cohort Rankings
              </h2>
              <span className="text-[11px] sm:text-xs md:text-sm text-gray-400 font-medium">Refreshes hourly</span>
            </div>

            {/* Rankings List */}
            <div className="space-y-3 sm:space-y-4">
              {currentData.rankings.map((item) => (
                <div
                  key={item.rank}
                  className="bg-white/80 border border-gray-200 p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between hover:bg-white hover:shadow-md transition"
                >
                  <div className="flex items-center space-x-3.5 sm:space-x-5">
                    <span className="text-xs sm:text-base md:text-lg font-bold text-gray-400 w-6 sm:w-8 md:w-10">#{item.rank}</span>
                    <div className="w-8 sm:w-11 md:w-14 h-8 sm:h-11 md:h-14 rounded-full bg-gray-200 text-gray-800 font-bold text-xs sm:text-base md:text-lg flex items-center justify-center">
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs sm:text-base md:text-lg font-bold text-gray-900">{item.name}</p>
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-400 mt-0.5">🔥 {item.streak} days streak</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 sm:space-x-4">
                    <span className="text-xs sm:text-base md:text-lg font-black text-gray-900">{item.points} pts</span>
                    <span
                      className={`text-[9px] sm:text-xs md:text-sm font-black px-2.5 sm:px-4 md:px-5 py-0.5 sm:py-1.5 md:py-2 rounded-full ${
                        item.status === 'GOING' ? 'bg-[#18191B] text-white' : 'bg-[#DFDACB] text-gray-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}

              {/* Current User Highlighted Card */}
              <div className="bg-[#FAF8F2] border-2 border-[#F25C3B] p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3.5 sm:space-x-5">
                  <span className="text-xs sm:text-base md:text-lg font-black text-[#F25C3B] w-6 sm:w-8 md:w-10">#{currentData.userRank}</span>
                  <div className="w-9 sm:w-12 md:w-14 h-9 sm:h-12 md:h-14 rounded-full bg-[#F25C3B] text-white font-black text-xs sm:text-base md:text-lg flex items-center justify-center shadow-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs sm:text-base md:text-lg font-black text-gray-950">{displayName} (You)</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-[#F25C3B] font-bold flex items-center gap-1 mt-0.5">
                      🔥 Active Streak • Keep going!
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 sm:space-x-4">
                  <span className="text-xs sm:text-base md:text-lg font-black text-gray-950">{currentData.userPoints} pts</span>
                  <span className="bg-[#F25C3B] text-white text-[9px] sm:text-xs md:text-sm font-black px-2.5 sm:px-4 md:px-5 py-0.5 sm:py-1.5 md:py-2 rounded-full">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Return CTA */}
          <div className="pt-4 sm:pt-6">
            <button
              type="button"
              onClick={() => handleNavigate('/dashboard', 'Returning to schedule...')}
              className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] active:scale-[0.98] text-white font-bold py-4 sm:py-5 md:py-6 px-6 rounded-2xl sm:rounded-3xl shadow-lg transition duration-200 cursor-pointer text-sm sm:text-base md:text-xl"
            >
              Back to Schedule
            </button>
          </div>
        </div>
      </main>

    </div>
  );
}
