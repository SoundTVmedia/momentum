import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Upload } from 'lucide-react'
import { useAuth } from '@getmocha/users-service/react'
import ConcertFeed, { FeedSectionHeader } from '@/react-app/components/ConcertFeed'
import FavoriteArtistFeedPanel from '@/react-app/components/FavoriteArtistFeedPanel'
import FeedFilters from '@/react-app/components/FeedFilters'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'
import SectionHeading from '@/react-app/components/SectionHeading'
import { HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout'

export type MainFeedStackVariant = 'page' | 'home'

type MainFeedStackProps = {
  variant?: MainFeedStackVariant
  /** Initial filter for the main clip grid on home and feed-style stacks. */
  defaultFeedType?: 'latest' | 'trending' | 'most_liked'
}

export default function MainFeedStack({
  variant = 'page',
  defaultFeedType = 'latest',
}: MainFeedStackProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [feedType, setFeedType] = useState(defaultFeedType)
  const isHome = variant === 'home'
  const containerClass = isHome
    ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-7'
    : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'

  return (
    <div className={containerClass}>
      {variant === 'page' && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <SectionHeading
              title="The Feed"
              subtitle="Live moments from concerts happening right now"
              size="section"
              className="mb-0"
            />
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

      {user ? (
        <FavoriteArtistFeedPanel
          variant="feed"
          edgeBleed={isHome}
          edgeBleedScope="page"
        />
      ) : null}

      <div className={isHome && user ? HOME_FEED_SECTION_CLASS : ''}>
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
      </div>

      {isHome ? (
        <PersonalizedConcerts carouselBleedScope="page" mode="nearby" />
      ) : null}
    </div>
  )
}
