import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Upload } from 'lucide-react'
import { useAuth } from '@getmocha/users-service/react'
import ConcertFeed, { FeedSectionHeader } from '@/react-app/components/ConcertFeed'
import {
  FEED_FILTER_OPTIONS,
  type FeedFilterValue,
} from '@/react-app/lib/feedFilterMeta'
import FavoriteArtistFeedPanel from '@/react-app/components/FavoriteArtistFeedPanel'
import FeedFilters from '@/react-app/components/FeedFilters'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'
import TonightShowsSection from '@/react-app/components/TonightShowsSection'
import GoingShowsFeedSection from '@/react-app/components/GoingShowsFeedSection'
import MyGoingShowsSection from '@/react-app/components/MyGoingShowsSection'
import SectionHeading from '@/react-app/components/SectionHeading'
import { BROWSE_NEARBY_SHOWS_PATH } from '@/react-app/lib/browse-paths'
import { HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout'

export type MainFeedStackVariant = 'page' | 'home'

type MainFeedStackProps = {
  variant?: MainFeedStackVariant
  /** Initial filter for the main clip grid on home and feed-style stacks. */
  defaultFeedType?: FeedFilterValue
}

export default function MainFeedStack({
  variant = 'page',
  defaultFeedType = 'latest',
}: MainFeedStackProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [feedType, setFeedType] = useState(defaultFeedType)
  const emptySceneTypesRef = useRef<Set<FeedFilterValue>>(new Set())
  const [emptySceneTypes, setEmptySceneTypes] = useState<Set<FeedFilterValue>>(
    () => new Set(),
  )
  const sceneFilterOptions = FEED_FILTER_OPTIONS.filter(
    (option) => !emptySceneTypes.has(option.value),
  )
  const handleFeedEmpty = useCallback((emptyType: FeedFilterValue) => {
    emptySceneTypesRef.current.add(emptyType)
    const skip = emptySceneTypesRef.current
    setEmptySceneTypes(new Set(skip))
    const fallback = FEED_FILTER_OPTIONS.find((option) => !skip.has(option.value))
    if (fallback) setFeedType(fallback.value)
  }, [])
  const isHome = variant === 'home'
  const containerClass = isHome
    ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4'
    : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'

  const fromTheSceneBlock = (
    <div className={isHome && user ? HOME_FEED_SECTION_CLASS : ''}>
      <div className="mb-5 md:mb-5">
        <FeedSectionHeader feedType={feedType} />
        <div className="mt-3 md:mt-4">
          {sceneFilterOptions.length > 0 ? (
            <FeedFilters
              currentFilter={
                sceneFilterOptions.some((option) => option.value === feedType)
                  ? feedType
                  : (sceneFilterOptions[0]?.value ?? feedType)
              }
              onFilterChange={setFeedType}
              options={sceneFilterOptions}
            />
          ) : null}
        </div>
      </div>

      <ConcertFeed
        feedType={feedType}
        hideSectionHeader
        edgeBleed={isHome}
        edgeBleedScope="page"
        suppressBottomPadding={isHome}
        onFeedEmpty={handleFeedEmpty}
      />
    </div>
  )

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

      {fromTheSceneBlock}

      {isHome ? <TonightShowsSection /> : null}

      {isHome ? (
        <PersonalizedConcerts
          carouselBleedScope="page"
          mode="nearby"
          viewAllHref={BROWSE_NEARBY_SHOWS_PATH}
          viewAllLabel="View all shows"
          sectionTitleOverride="Upcoming Shows"
          sectionSubtitleOverride={
            user ? undefined : 'Upcoming shows at venues near you from JamBase'
          }
        />
      ) : null}

      {isHome && user ? <MyGoingShowsSection variant="home" /> : null}

      {isHome && user ? <GoingShowsFeedSection /> : null}
    </div>
  )
}
