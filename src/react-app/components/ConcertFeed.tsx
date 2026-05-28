import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useClips } from '@/react-app/hooks/useClips'
import ClipModal from './ClipModal'
import ClipFeedGridTile from './ClipFeedGridTile'
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from './HorizontalClipCarousel'
import { ClipGridTileSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'
import type { ClipWithUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'
import SectionHeading from '@/react-app/components/SectionHeading'
import {
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout'
import { getFeedFilterMeta, type FeedFilterValue } from '@/react-app/lib/feedFilterMeta'

interface ConcertFeedProps {
  feedType?: 'latest' | 'trending' | 'most_liked'
  artistName?: string
  venueName?: string
  songSlug?: string
  genreSlug?: string
  userId?: string
  /** When true, omit the large title/subtitle block (e.g. stacked sections on Home). */
  hideSectionHeader?: boolean
  /** No outer max-width box; carousel bleeds to screen edge on mobile. */
  edgeBleed?: boolean
  /** Padding to counteract when `edgeBleed` is set (home vs max-w-7xl pages). */
  edgeBleedScope?: 'home' | 'page'
  /** Drop extra bottom padding when another home section follows (e.g. shows carousel). */
  suppressBottomPadding?: boolean
}

export function FeedSectionHeader({
  feedType = 'latest',
}: {
  feedType?: FeedFilterValue
}) {
  const { label, description } = getFeedFilterMeta(feedType)

  return (
    <SectionHeading title={label} subtitle={description} size="section" />
  )
}

function feedCarouselLabel(
  feedType: ConcertFeedProps['feedType'],
  artistName?: string,
  venueName?: string,
  songSlug?: string,
  genreSlug?: string,
): string {
  if (artistName) return `Clips from ${artistName}`
  if (venueName) return `Clips from ${venueName}`
  if (songSlug) return `Clips for song ${songSlug.replace(/-/g, ' ')}`
  if (genreSlug) return `Clips in ${genreSlug.replace(/-/g, ' ')}`
  switch (feedType) {
    case 'trending':
      return 'Trending clips'
    case 'most_liked':
      return 'Most liked clips'
    default:
      return 'Latest clips'
  }
}

export default function ConcertFeed({
  feedType = 'latest',
  artistName,
  venueName,
  songSlug,
  genreSlug,
  userId,
  hideSectionHeader = false,
  edgeBleed = false,
  edgeBleedScope = 'page',
  suppressBottomPadding = false,
}: ConcertFeedProps) {
  const navigate = useNavigate()
  const { clips, loading, hasMore, loadMore, error, refetch, updateClip } = useClips({
    feedType,
    artistName,
    venueName,
    songSlug,
    genreSlug,
    userId,
    enablePolling:
      feedType === 'latest' &&
      !artistName &&
      !venueName &&
      !songSlug &&
      !genreSlug &&
      !userId,
  })

  const carouselScrollRef = useRef<HTMLDivElement>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null)

  useEffect(() => {
    const root = carouselScrollRef.current
    const target = loadMoreSentinelRef.current
    if (!root || !target || clips.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { root, threshold: 0.1, rootMargin: '120px' },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [clips.length, hasMore, loading, loadMore])

  const carouselClass = edgeBleed
    ? edgeBleedScope === 'home'
      ? HOME_FEED_CAROUSEL_BLEED
      : PAGE_CAROUSEL_BLEED
    : '-mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 md:pt-1 md:pb-2'

  const feedContent = (
    <>
        {!hideSectionHeader && (
          <div className="mb-4 sm:mb-5 md:mb-5">
            <FeedSectionHeader feedType={feedType} />
          </div>
        )}

        {error && clips.length === 0 ? (
          <NetworkError
            onRetry={refetch}
            message="Failed to load clips. Please check your connection and try again."
          />
        ) : loading && clips.length === 0 ? (
          <HorizontalClipCarousel
            key={`${feedType}-loading`}
            ariaLabel={feedCarouselLabel(feedType, artistName, venueName, songSlug, genreSlug)}
            className={carouselClass}
            stretchItems
            filmstrip
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <HorizontalClipCarouselItem key={`sk-${i}`}>
                <ClipGridTileSkeleton />
              </HorizontalClipCarouselItem>
            ))}
          </HorizontalClipCarousel>
        ) : clips.length > 0 ? (
          <>
            <HorizontalClipCarousel
              key={feedType}
              ref={carouselScrollRef}
              ariaLabel={feedCarouselLabel(feedType, artistName, venueName, songSlug, genreSlug)}
              className={carouselClass}
              stretchItems
              filmstrip
            >
              {clips.map((clip, index) => (
                <HorizontalClipCarouselItem key={clipListItemKey(clip, index)}>
                  <ClipFeedGridTile clip={clip} onOpenClip={setSelectedClip} />
                </HorizontalClipCarouselItem>
              ))}
              {hasMore ? (
                <div
                  ref={loadMoreSentinelRef}
                  className="flex-shrink-0 w-px h-px opacity-0 snap-none"
                  aria-hidden
                />
              ) : null}
            </HorizontalClipCarousel>

            <div className="mt-4 flex flex-col items-center justify-center gap-1 min-h-[2rem]">
              {loading && clips.length > 0 ? (
                <p className="text-momentum-flare text-sm font-medium">Loading more moments…</p>
              ) : null}
              {!loading && !hasMore && clips.length > 0 ? (
                <p className="text-gray-500 text-sm">You&apos;ve reached the end</p>
              ) : null}
            </div>
          </>
        ) : null}

        {clips.length === 0 && !loading && !error && (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto glass-highlight rounded-xl p-8 space-y-4">
              <div className="text-6xl mb-4">🎸</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Clips Yet</h3>
              <p className="text-gray-300 mb-6">
                Be the first to drop a moment from tonight&apos;s show!
              </p>
              <button
                onClick={() => navigate('/upload')}
                className="px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-105 transition-transform"
              >
                Share Your Moment
              </button>
            </div>
          </div>
        )}
    </>
  )

  return (
    <section
      className={
        edgeBleed
          ? `${HOME_FEED_SECTION_CLASS}${suppressBottomPadding ? '' : ' md:pb-6'}`
          : 'py-4 sm:py-6 md:py-8 bg-black md:pb-8'
      }
    >
      {edgeBleed ? (
        feedContent
      ) : (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">{feedContent}</div>
      )}

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          feedNavigation={
            clips.length > 1 ? { clips, onChangeClip: setSelectedClip } : null
          }
          onClipUpdated={(updated) => {
            setSelectedClip(updated)
            updateClip(updated)
          }}
        />
      ) : null}
    </section>
  )
}
