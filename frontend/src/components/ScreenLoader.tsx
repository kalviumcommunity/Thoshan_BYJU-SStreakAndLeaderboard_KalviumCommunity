interface ScreenLoaderProps {
  message?: string;
}

export default function ScreenLoader({ message = 'Loading...' }: ScreenLoaderProps) {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#18191B] flex flex-col items-center justify-center p-6 text-center select-none font-sans relative overflow-hidden animate-fadeIn">
      
      {/* Ambient subtle glow background */}
      <div className="absolute w-72 h-72 bg-[#F25C3B]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Animated Brand Centerpiece */}
      <div className="relative z-10 my-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-[#F25C3B] to-[#FF8C68] rounded-2xl flex items-center justify-center shadow-xl shadow-[#F25C3B]/50 animate-pulseGlow">
          <span className="transform -rotate-45 text-2xl sm:text-3xl">🎓</span>
        </div>
      </div>

      {/* Text & Micro Progress Bar */}
      <div className="space-y-3 relative z-10">
        <p className="text-sm sm:text-base font-bold text-white tracking-tight">{message}</p>
        <div className="w-36 sm:w-44 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
          <div className="w-full h-full bg-[#F25C3B] rounded-full animate-pulse"></div>
        </div>
      </div>

      <p className="text-[10px] sm:text-xs text-gray-500 font-medium tracking-wider uppercase pt-4">
        byjus streak engine
      </p>
    </div>
  );
}
