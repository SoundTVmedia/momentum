import { useEffect, useState } from 'react'

interface PlatformStatsProps {
  compact?: boolean
}

export default function PlatformStats({ compact = false }: PlatformStatsProps) {
  const [stats, setStats] = useState({
    liveViewers: 0,
    concertsTonight: 0,
    momentsShared: 0
  })

  useEffect(() => {
    // Simulate real-time stats
    const interval = setInterval(() => {
      setStats({
        liveViewers: Math.floor(Math.random() * 1000) + 2500,
        concertsTonight: Math.floor(Math.random() * 20) + 45,
        momentsShared: Math.floor(Math.random() * 500) + 1200
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Compact inline version for use in layouts
  if (compact) {
    return (
      <div>
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-headline">
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Momentum By The Numbers</span>
          </h2>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 backdrop-blur-strong border border-blue-500/30 rounded-xl p-3 sm:p-4 min-w-[120px] flex-1 hover:scale-105 transition-transform">
            <div className="text-2xl sm:text-3xl font-headline bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
              {stats.liveViewers.toLocaleString()}
            </div>
            <div className="text-xs text-white/70 font-medium">Live Viewers</div>
          </div>

          <div className="bg-gradient-to-br from-cyan-600/10 to-purple-600/10 backdrop-blur-strong border border-cyan-500/30 rounded-xl p-3 sm:p-4 min-w-[120px] flex-1 hover:scale-105 transition-transform">
            <div className="text-2xl sm:text-3xl font-headline bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-1">
              {stats.concertsTonight}
            </div>
            <div className="text-xs text-white/70 font-medium">Concerts Tonight</div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/10 to-blue-600/10 backdrop-blur-strong border border-purple-500/30 rounded-xl p-3 sm:p-4 min-w-[120px] flex-1 hover:scale-105 transition-transform">
            <div className="text-2xl sm:text-3xl font-headline bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-1">
              {stats.momentsShared.toLocaleString()}
            </div>
            <div className="text-xs text-white/70 font-medium">Moments Shared</div>
          </div>
        </div>
      </div>
    )
  }

  // Full section version
  return (
    <section className="py-8 sm:py-12 md:py-16 bg-gradient-to-b from-black via-slate-900/50 to-black">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline text-white mb-2">
            The Pulse of <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">MOMENTUM</span>
          </h2>
          <p className="text-sm sm:text-base text-gray-400">Real-time platform activity</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8">
          <div className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 backdrop-blur-strong border border-blue-500/30 rounded-2xl p-4 sm:p-6 md:p-8 min-w-[140px] sm:min-w-[180px] md:min-w-[220px] hover:scale-105 transition-transform">
            <div className="text-3xl sm:text-4xl md:text-5xl font-headline bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              {stats.liveViewers.toLocaleString()}
            </div>
            <div className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Live Viewers</div>
          </div>

          <div className="bg-gradient-to-br from-cyan-600/10 to-purple-600/10 backdrop-blur-strong border border-cyan-500/30 rounded-2xl p-4 sm:p-6 md:p-8 min-w-[140px] sm:min-w-[180px] md:min-w-[220px] hover:scale-105 transition-transform">
            <div className="text-3xl sm:text-4xl md:text-5xl font-headline bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {stats.concertsTonight}
            </div>
            <div className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Concerts Tonight</div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/10 to-blue-600/10 backdrop-blur-strong border border-purple-500/30 rounded-2xl p-4 sm:p-6 md:p-8 min-w-[140px] sm:min-w-[180px] md:min-w-[220px] hover:scale-105 transition-transform">
            <div className="text-3xl sm:text-4xl md:text-5xl font-headline bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
              {stats.momentsShared.toLocaleString()}
            </div>
            <div className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Moments Shared</div>
          </div>
        </div>
      </div>
    </section>
  )
}
