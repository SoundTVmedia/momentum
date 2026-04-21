import { useState } from 'react'
import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import TrendingFilmstrip from '@/react-app/components/TrendingFilmstrip'
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      {/* 1. Hero Section - WHERE LIVE MUSIC LIVES */}
      <HeroSection />
      
      {/* 2. Live Broadcast - Show full player when live */}
      {isLive && <LiveBroadcast layoutMode="full" />}

      {/* 3. Real Time Feed and Set Reminder (when NOT LIVE) */}
      {!isLive && (
        <div className="bg-gradient-to-b from-black via-purple-900/10 to-black py-4">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              {/* Real Time Feed - Left side on desktop */}
              <div className="space-y-6">
                <PlatformStats compact />
              </div>
              
              {/* Set Reminder & Schedule - Right side on desktop */}
              <div className="space-y-6">
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-headline">
                      <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Tonight's Show</span>
                    </h2>
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
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
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
      
      {/* 4. Personalized Concerts (for logged in users) */}
      {user && (
        <div className="bg-gradient-to-b from-black to-slate-900 py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PersonalizedConcerts />
          </div>
        </div>
      )}
      
      {/* 5. Nearby Shows CTA */}
      <div className="bg-gradient-to-b from-black to-slate-900 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <NearbyShowsCTA variant="banner" maxShows={1} />
        </div>
      </div>

      {/* 6. Discover Events Section */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900/50 to-black pb-12 sm:pb-16 md:pb-20">
        <DiscoverSection />
      </div>
      
      {/* 7. Leaderboard Section */}
      <div className="bg-gradient-to-b from-slate-900 to-black py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Leaderboard />
        </div>
      </div>
      
      {/* 8. Footer */}
      <Footer />
    </div>
  )
}
