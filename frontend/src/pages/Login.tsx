import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signUp, signInWithGoogle } from '../services/auth';
import ScreenLoader from '../components/ScreenLoader';

export default function Login() {
  const navigate = useNavigate();
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, name);
      } else {
        await login(email, password);
      }
      setIsNavigating(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 280);
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      setIsNavigating(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 280);
    } catch (err: unknown) {
      console.error('Google Auth error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.';
      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  if (isNavigating) {
    return <ScreenLoader message="Launching your dashboard..." />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#EFECE1] flex flex-col justify-between items-center p-5 sm:p-8 font-sans text-gray-900 select-none animate-screen">
      
      {/* Centered Content Container */}
      <div className="max-w-md w-full my-auto space-y-6">
        
        {/* Top Brand Header */}
        <div>
          <div className="flex items-center justify-center space-x-2 pt-2 pb-2">
            <svg className="w-6 h-6 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
            </svg>
            <span className="text-xl font-black tracking-tight text-gray-900">
              byjus streak
            </span>
          </div>

          {/* Hero Illustration Card */}
          <div className="w-full h-44 sm:h-52 bg-[#18191B] rounded-[28px] p-6 flex items-center justify-center shadow-lg relative overflow-hidden my-3">
            {/* Concentric radiating circles */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
              <div className="w-64 h-64 border border-white/20 rounded-full"></div>
              <div className="w-48 h-48 border border-white/25 rounded-full absolute"></div>
              <div className="w-32 h-32 border border-white/30 rounded-full absolute"></div>
            </div>

            {/* Glowing Center Star */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-[#F25C3B] to-[#FF8C68] rounded-2xl flex items-center justify-center shadow-lg shadow-[#F25C3B]/40 transform rotate-45 animate-pulse">
                <span className="transform -rotate-45 text-2xl">🎓</span>
              </div>
              <span className="text-[11px] font-bold text-amber-400/90 tracking-widest uppercase mt-3">
                Daily Streak Engine
              </span>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="text-center space-y-2 pt-2 px-2">
            <h1 className="text-2xl sm:text-[28px] font-black text-gray-950 leading-tight">
              Generate a streak from your daily learning & habits.
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-[320px] mx-auto">
              Create consistent daily study milestones and climb your cohort leaderboard in zero seconds.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 bg-red-100/80 border border-red-300 text-red-800 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {isEmailMode ? (
            <form onSubmit={handleSubmit} className="space-y-2.5 animate-fadeIn">
              {isSignUp && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignUp}
                  className="w-full px-4 py-3.5 bg-white/90 border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
                />
              )}
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/90 border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3.5 bg-white/90 border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B]"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] text-white font-bold py-4 px-4 rounded-2xl shadow-md transition duration-200 disabled:opacity-60 cursor-pointer text-sm sm:text-base"
              >
                {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full bg-[#F25C3B] hover:bg-[#E04B2A] active:scale-[0.98] text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-[#F25C3B]/25 transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer text-sm sm:text-base"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>{googleLoading ? 'Connecting...' : 'Get Started with Google'}</span>
            </button>
          )}

          <div className="flex items-center justify-center space-x-3 text-xs sm:text-sm text-gray-500 pt-1">
            <button
              type="button"
              onClick={() => { setIsEmailMode(!isEmailMode); setError(null); }}
              className="hover:text-gray-900 font-semibold cursor-pointer underline"
            >
              {isEmailMode ? '← Use Google Sign-In' : 'Sign in with Email'}
            </button>

            {isEmailMode && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                  className="text-[#F25C3B] font-bold hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Have account? Login' : 'New here? Sign Up'}
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      <div className="text-[11px] text-gray-400 font-medium py-2">
        BYJU'S Streak & Habit Engine
      </div>
    </div>
  );
}
