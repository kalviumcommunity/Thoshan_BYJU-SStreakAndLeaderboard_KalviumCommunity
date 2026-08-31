import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signUp } from '../services/auth';
import ScreenLoader from '../components/ScreenLoader';

export default function Login() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please verify your confirm password.');
        }
        await signUp(email, password, name);
      } else {
        await login(email, password);
      }
      setIsNavigating(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 280);
    } catch (err: unknown) {
      console.error('JWT Auth error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (isNavigating) {
    return <ScreenLoader message="Launching your dashboard..." />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#EFECE1] flex flex-col justify-between items-center p-5 sm:p-8 font-sans text-gray-900 select-none animate-screen">

      {/* Centered Content Container */}
      <div className="max-w-md w-full my-auto space-y-5">

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
          <div className="w-full h-40 sm:h-48 bg-[#18191B] rounded-[28px] p-6 flex items-center justify-center shadow-lg relative overflow-hidden my-3">
            {/* Concentric radiating circles */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
              <div className="w-64 h-64 border border-white/20 rounded-full"></div>
              <div className="w-48 h-48 border border-white/25 rounded-full absolute"></div>
              <div className="w-32 h-32 border border-white/30 rounded-full absolute"></div>
            </div>

            {/* Glowing Center Star */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-[#F25C3B] to-[#FF8C68] rounded-2xl flex items-center justify-center shadow-lg shadow-[#F25C3B]/40 transform rotate-45 animate-pulse">
                <span className="transform -rotate-45 text-2xl">🎓</span>
              </div>
              <span className="text-[11px] font-bold text-amber-400/90 tracking-widest uppercase mt-3">
                Your Streaks and Leaderboard.
              </span>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="text-center space-y-1.5 pt-1 px-2">
            <h1 className="text-2xl sm:text-[28px] font-black text-gray-950 leading-tight">
              {isSignUp ? 'Create your Learner Account' : 'Welcome back to BYJU\'S'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-[320px] mx-auto">
              {isSignUp
                ? 'Sign up with JWT authentication to start tracking your daily study streaks.'
                : 'Log in with your secure credentials to view tasks and cohort leaderboards.'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 bg-red-100/90 border border-red-300 text-red-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
              <span>⚠️</span>
              <span className="flex-1 font-medium">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-700 font-bold hover:opacity-75 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Auth Mode Switcher */}
        <div className="flex p-1 bg-white/80 rounded-2xl border border-gray-300/70 shadow-xs">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              !isSignUp ? 'bg-[#18191B] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              isSignUp ? 'bg-[#18191B] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* JWT Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3 animate-fadeIn">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 px-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Aakash Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={isSignUp}
                className="w-full px-4 py-3 bg-white border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B] shadow-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 px-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B] shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 px-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-4 pr-11 py-3 bg-white border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B] shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-700 cursor-pointer focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 px-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={isSignUp}
                  minLength={6}
                  className="w-full pl-4 pr-11 py-3 bg-white border border-gray-300/80 rounded-2xl text-xs sm:text-sm font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F25C3B] shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-700 cursor-pointer focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#F25C3B] hover:bg-[#E04B2A] text-white py-3.5 rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>{isSignUp ? 'Create Learner Account' : 'Log In to BYJU\'S'}</span>
            )}
          </button>
        </form>

        {/* Demo Credentials Helper */}
        <div className="bg-white/70 border border-gray-300/80 rounded-2xl p-3.5 text-center text-xs space-y-1 shadow-xs">
          <p className="font-bold text-gray-700">Quick Demo Learner Account</p>
          <p className="text-gray-500 font-mono text-[11px]">zayn.merchant@demo.example.com • DemoPass@123</p>
        </div>

      </div>

      {/* Footer Branding */}
      <footer className="text-center text-gray-500 text-[11px] font-medium py-3">
        <span>BYJU'S Learning App • Streak & Leaderboard System</span>
      </footer>

    </div>
  );
}
