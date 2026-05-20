import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Upload } from 'lucide-react'
import { useAuth } from '@getmocha/users-service/react'
import type { ExtendedMochaUser } from '@/shared/types'
import { resolveWelcomeName } from '@/react-app/lib/resolveWelcomeName'
import ConcertFeed, { FeedSectionHeader } from '@/react-app/components/ConcertFeed'
import FavoriteArtistFeedPanel from '@/react-app/components/FavoriteArtistFeedPanel'
import FeedFilters from '@/react-app/components/FeedFilters'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'
import FavoriteArtistYouTubeSection from '@/react-app/components/FavoriteArtistYouTubeSection'

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
    ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-7'
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
        <div className="mb-6 md:mb-5">
          <h2 className="text-2xl sm:text-3xl font-headline text-white mb-2">
            {welcomeName ? (
              <>
                <span>Welcome, </span>
                <span className="momentum-grad-text">{welcomeName}</span>
              </>
            ) : (
              'Welcome'
            )}
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Your artists, nearby venues, and what&apos;s hot on the platform
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

      <div className="mb-5 md:mb-5">
        <FeedSectionHeader feedType={feedType} />
        <div className="mt-3 md:mt-4">
          <FeedFilters currentFilter={feedType} onFilterChange={setFeedType} />
        </div>
      </div>

      <ConcertFeed
        feedType={feedType}
        hideSectionHeader
        edgeBleed={isHome}
        edgeBleedScope="page"
        suppressBottomPadding={isHome}
      />

      {isHome ? (
        <div className="space-y-8 md:space-y-6">
          <PersonalizedConcerts carouselBleedScope="page" mode="favorite-artists" />
          <PersonalizedConcerts carouselBleedScope="page" mode="nearby" />
          <FavoriteArtistYouTubeSection carouselBleedScope="page" />
        </div>
      ) : null}
    </div>
  )
}
