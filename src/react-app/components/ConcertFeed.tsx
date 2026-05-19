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
import {
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout'
import { getFeedFilterMeta, type FeedFilterValue } from '@/react-app/lib/feedFilterMeta'

interface ConcertFeedProps {
  feedType?: 'latest' | 'trending' | 'most_liked' | 'top_rated'
  artistName?: string
  venueName?: string
  userId?: string
  /** When true, omit the large title/subtitle block (e.g. stacked sections on Home). */
  hideSectionHeader?: boolean
  /** No outer max-width box; carousel bleeds to screen edge on mobile. */
  edgeBleed?: boolean
  /** Padding to counteract when `edgeBleed` is set (home vs max-w-7xl pages). */
  edgeBleedScope?: 'home' | 'page'
}

export function FeedSectionHeader({
  feedType = 'latest',
}: {
  feedType?: FeedFilterValue
}) {
  const { label, description } = getFeedFilterMeta(feedType)

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
        {label}
      </h2>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
    </div>
  )
}

function feedCarouselLabel(
  feedType: ConcertFeedProps['feedType'],
  artistName?: string,
  venueName?: string,
): string {
  if (artistName) return `Clips from ${artistName}`
  if (venueName) return `Clips from ${venueName}`
  switch (feedType) {
    case 'trending':
      return 'Trending clips'
    case 'most_liked':
      return 'Most liked clips'
    case 'top_rated':
      return 'Top rated clips'
    default:
      return 'Latest clips'
  }
}

export default function ConcertFeed({
  feedType = 'latest',
  artistName,
  venueName,
  userId,
  hideSectionHeader = false,
  edgeBleed = false,
  edgeBleedScope = 'page',
}: ConcertFeedProps) {
  const navigate = useNavigate()
  const { clips, loading, hasMore, loadMore, error, refetch } = useClips({
    feedType,
    artistName,
    venueName,
    userId,
    enablePolling: feedType === 'latest' && !artistName && !venueName && !userId,
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
            ariaLabel={feedCarouselLabel(feedType, artistName, venueName)}
            className={carouselClass}
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
              ariaLabel={feedCarouselLabel(feedType, artistName, venueName)}
              className={carouselClass}
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
                <p className="text-cyan-400 text-sm font-medium">Loading more moments…</p>
              ) : null}
              {!loading && !hasMore && clips.length > 0 ? (
                <p className="text-gray-500 text-sm">You&apos;ve reached the end</p>
              ) : null}
            </div>
          </>
        ) : null}

        {clips.length === 0 && !loading && !error && (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto bg-gradient-to-br from-momentum-teal/18 to-momentum-mint/10 backdrop-blur-lg border border-momentum-teal/25 rounded-xl p-8 space-y-4">
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
          ? `${HOME_FEED_SECTION_CLASS} pb-16 md:pb-6`
          : 'py-4 sm:py-6 md:py-8 bg-black pb-20 md:pb-8'
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
        />
      ) : null}
    </section>
  )
}
