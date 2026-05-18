import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Upload } from 'lucide-react'
import { useAuth } from '@getmocha/users-service/react'
import type { ExtendedMochaUser } from '@/shared/types'
import { resolveWelcomeName } from '@/react-app/lib/resolveWelcomeName'
import ConcertFeed from '@/react-app/components/ConcertFeed'
import FavoriteArtistFeedPanel from '@/react-app/components/FavoriteArtistFeedPanel'
import FeedFilters from '@/react-app/components/FeedFilters'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'

export type MainFeedStackVariant = 'page' | 'home'

type MainFeedStackProps = {
  variant?: MainFeedStackVariant
  /** Initial filter for the main clip grid on home and feed-style stacks. */
  defaultFeedType?: 'latest' | 'trending' | 'most_liked' | 'top_rated'
}

export default function MainFeedStack({
  variant = 'page',
  defaultFeedType = 'latest',
}: MainFeedStackProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [feedType, setFeedType] = useState(defaultFeedType)
  const welcomeName = user ? resolveWelcomeName(user as ExtendedMochaUser) : null
  const isHome = variant === 'home'
  const containerClass = isHome
    ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
    : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'

  return (
    <div className={containerClass}>
      {variant === 'page' && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-headline text-white mb-2">The Feed</h1>
            <p className="text-gray-400">Live moments from concerts happening right now</p>
          </div>

          {user && (
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="hidden sm:flex items-center space-x-2 px-4 py-2 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-105 transition-transform"
            >
              <Upload className="w-5 h-5" />
              <span>Share Moment</span>
            </button>
          )}
        </div>
      )}

      {variant === 'home' && user && (
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-headline text-white mb-2">
            {welcomeName ? (
              <>
                <span>Welcome, </span>
                <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                  {welcomeName}
                </span>
              </>
            ) : (
              'Welcome'
            )}
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            From artists you follow, shows near you, and what&apos;s hot on the platform
          </p>
        </div>
      )}

      {user ? (
        <FavoriteArtistFeedPanel
          variant="feed"
          edgeBleed={isHome}
          edgeBleedScope="page"
        />
      ) : null}

      <div className="mb-6">
        <FeedFilters currentFilter={feedType} onFilterChange={setFeedType} />
      </div>

      <ConcertFeed
        feedType={feedType}
        edgeBleed={isHome}
        edgeBleedScope="page"
      />

      {user && isHome ? <PersonalizedConcerts carouselBleedScope="page" /> : null}
    </div>
  )
}
