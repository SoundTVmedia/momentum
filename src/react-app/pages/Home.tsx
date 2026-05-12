import { useState } from 'react'
import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import LiveBroadcast from '@/react-app/components/LiveBroadcast'
import PlatformStats from '@/react-app/components/PlatformStats'
import DiscoverSection from '@/react-app/components/DiscoverSection'
import Footer from '@/react-app/components/Footer'
import Leaderboard from '@/react-app/components/Leaderboard'
import LiveSchedulePreview from '@/react-app/components/LiveSchedulePreview'
import NearbyShowsCTA from '@/react-app/components/NearbyShowsCTA'
import ConcertFeed from '@/react-app/components/ConcertFeed'
import FeedFilters from '@/react-app/components/FeedFilters'
import { useLiveSession } from '@/react-app/hooks/useLiveSession'
import { useLiveSchedule } from '@/react-app/hooks/useLiveSchedule'
import { useAuth } from '@getmocha/users-service/react'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'

export default function Home() {
  const { user } = useAuth()
  const { session } = useLiveSession()
  const { schedule } = useLiveSchedule(session?.id || null)
  const isLive = session?.status === 'live'
  const [feedType, setFeedType] = useState<'latest' | 'trending' | 'most_liked' | 'top_rated'>('trending')
  
  const upcomingClips = schedule.filter(item => !item.played_at)

  /** Deep base + aqua wash; absolute blurs add violet/amber accents. */
  const homeContentBandClass =
    'relative py-6 sm:py-8 bg-gradient-to-b from-black via-momentum-teal/12 to-slate-950'

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      {/* 1. Hero Section - WHERE LIVE MUSIC LIVES */}
      <HeroSection />
      
      {/* 2. Live Broadcast - Show full player when live */}
      {isLive && <LiveBroadcast layoutMode="full" />}

      {/* 3. Stats + Tonight's Show + schedule (not live), or stats + feed continuation (live) */}
      {!isLive && (
        <div className={homeContentBandClass}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-momentum-teal/20 blur-3xl" />
            <div className="absolute bottom-1/3 right-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
            <div className="absolute top-1/2 right-1/3 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              {/* Real Time Feed - Left side on desktop */}
              <div className="space-y-6">
                <div className="mb-2">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-headline text-white">
                    <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                      Live Pulse
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">What the community is doing right now</p>
                </div>
                <PlatformStats compact />
              </div>
              
              {/* Set Reminder & Schedule - Right side on desktop */}
              <div className="space-y-6">
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-headline">
                      <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                        Tonight&apos;s Show
                      </span>
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">Set a reminder and peek at the lineup</p>
                  </div>
                  <LiveBroadcast layoutMode="compact" />
                </div>
                {upcomingClips.length > 0 && (
                  <LiveSchedulePreview items={upcomingClips} showShareOptions={true} />
                )}
              </div>
            </div>

            {/* 4. Live Now! Trending Clips with Filters - Right below Real Time Feed */}
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl sm:text-3xl font-headline text-white">
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Live Feed
                  </span>
                </h2>
              </div>
              
              <FeedFilters 
                currentFilter={feedType} 
                onFilterChange={setFeedType} 
              />
              
              <ConcertFeed feedType={feedType} />
            </div>
          </div>
        </div>
      )}

      {isLive && (
        <div className={homeContentBandClass}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-momentum-teal/20 blur-3xl" />
            <div className="absolute bottom-1/3 right-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              <div className="space-y-4">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-headline">
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Tonight&apos;s Show
                  </span>
                </h2>
                <p className="text-sm text-gray-400">By the numbers while we&apos;re on air</p>
                <PlatformStats compact />
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl sm:text-3xl font-headline text-white">
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Live Feed
                  </span>
                </h2>
              </div>
              <FeedFilters currentFilter={feedType} onFilterChange={setFeedType} />
              <ConcertFeed feedType={feedType} />
            </div>
          </div>
        </div>
      )}
      
      {/* Personalized Concerts (for logged in users) */}
      {user && (
        <div className="bg-gradient-to-b from-black via-momentum-teal/8 to-slate-950 py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PersonalizedConcerts />
          </div>
        </div>
      )}
      
      {/* 5. Nearby Shows CTA */}
      <div className="bg-gradient-to-b from-black via-momentum-teal/8 to-slate-950 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <NearbyShowsCTA variant="banner" maxShows={1} />
        </div>
      </div>

      {/* 6. Discover Events Section */}
      <div className="bg-gradient-to-b from-slate-950 via-momentum-teal/6 to-black pb-12 sm:pb-16 md:pb-20">
        <DiscoverSection />
      </div>
      
      {/* 7. Leaderboard Section */}
      <div className="bg-gradient-to-b from-slate-950 via-violet-950/10 to-black py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Leaderboard />
        </div>
      </div>
      
      {/* 8. Footer */}
      <Footer />
    </div>
  )
}
