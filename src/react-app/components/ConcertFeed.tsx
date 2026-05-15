import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useClips } from '@/react-app/hooks/useClips'
import ClipModal from './ClipModal'
import ClipFeedGridTile from './ClipFeedGridTile'
import { ClipGridTileSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'
import type { ClipWithUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'

interface ConcertFeedProps {
  feedType?: 'latest' | 'trending' | 'most_liked' | 'top_rated'
  artistName?: string
  venueName?: string
  userId?: string
  /** When true, omit the large title/subtitle block (e.g. stacked sections on Home). */
  hideSectionHeader?: boolean
}

export default function ConcertFeed({ 
  feedType = 'latest', 
  artistName, 
  venueName, 
  userId,
  hideSectionHeader = false,
}: ConcertFeedProps) {
  const navigate = useNavigate()
  const { clips, loading, hasMore, loadMore, error, refetch } = useClips({
    feedType,
    artistName,
    venueName,
    userId,
    enablePolling: feedType === 'latest' && !artistName && !venueName && !userId,
  })
  
  const observerTarget = useRef<HTMLDivElement>(null)
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null)

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, loadMore])

  return (
    <section className="py-4 sm:py-6 md:py-8 bg-black pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {!hideSectionHeader && (
          <div className="text-center mb-4 sm:mb-6 md:mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline text-white mb-2 sm:mb-3">
              {feedType === 'trending' ? (
                <>
                  What&apos;s{' '}
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Hot Right Now
                  </span>
                </>
              ) : feedType === 'top_rated' ? (
                <>
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Top Rated
                  </span>{' '}
                  Moments
                </>
              ) : (
                <>
                  Live From{' '}
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    The Scene
                  </span>
                </>
              )}
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-400 px-4">
              {feedType === 'trending'
                ? "Fire moments the community can't stop watching"
                : feedType === 'top_rated'
                  ? 'The highest rated concert moments'
                  : "Fresh drops from tonight's shows"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {error && clips.length === 0 ? (
            // Show error state on initial load failure
            <div className="col-span-full">
              <NetworkError
                onRetry={refetch}
                message="Failed to load clips. Please check your connection and try again."
              />
            </div>
          ) : loading && clips.length === 0 ? (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <ClipGridTileSkeleton key={`sk-${i}`} />
              ))}
            </>
          ) : (
            <>
              {clips.map((clip, index) => (
                <ClipFeedGridTile
                  key={clipListItemKey(clip, index)}
                  clip={clip}
                  onOpenClip={setSelectedClip}
                />
              ))}
              <div
                key="feed-scroll-sentinel"
                ref={observerTarget}
                className="col-span-full h-12 flex flex-col items-center justify-center mt-4 gap-1"
              >
                {loading && clips.length > 0 && (
                  <div className="text-cyan-400 text-sm font-medium">Loading more moments...</div>
                )}
                {!loading && !hasMore && clips.length > 0 && (
                  <div className="text-gray-500 text-sm">You've reached the end</div>
                )}
              </div>
            </>
          )}
        </div>

        {clips.length === 0 && !loading && !error && (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto bg-gradient-to-br from-momentum-teal/18 to-momentum-mint/10 backdrop-blur-lg border border-momentum-teal/25 rounded-xl p-8 space-y-4">
              <div className="text-6xl mb-4">🎸</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                No Clips Yet
              </h3>
              <p className="text-gray-300 mb-6">
                Be the first to drop a moment from tonight's show!
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
      </div>

      {/* Clip Modal */}
      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          feedNavigation={
            clips.length > 1
              ? { clips, onChangeClip: setSelectedClip }
              : null
          }
        />
      )}

    </section>
  )
}
