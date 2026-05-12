import { Heart, MessageCircle, Share, MapPin, Clock, Bookmark } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useClips } from '@/react-app/hooks/useClips'
import { useClipLike } from '@/react-app/hooks/useClipLike'
import { useClipSave } from '@/react-app/hooks/useClipSave'
import ClipModal from './ClipModal'
import ClipFeedPreviewMedia from './ClipFeedPreviewMedia'
import { ClipGridTileSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'
import type { ClipWithUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'
import { artistPath, venuePath } from '@/shared/app-paths'

interface ConcertFeedProps {
  feedType?: 'latest' | 'trending' | 'most_liked' | 'top_rated'
  artistName?: string
  venueName?: string
  userId?: string
}

export default function ConcertFeed({ 
  feedType = 'latest', 
  artistName, 
  venueName, 
  userId 
}: ConcertFeedProps) {
  const navigate = useNavigate()
  const { clips, loading, hasMore, loadMore, error, refetch } = useClips({
    feedType,
    artistName,
    venueName,
    userId,
    enablePolling: feedType === 'latest' && !artistName && !venueName && !userId,
  })
  
  const { toggleLike, isLiked } = useClipLike()
  const { toggleSave, isSaved } = useClipSave()
  const [likingClip, setLikingClip] = useState<number | null>(null)
  const observerTarget = useRef<HTMLDivElement>(null)
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null)
  const [hoverClipId, setHoverClipId] = useState<number | null>(null)

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

  const handleLike = async (clipId: number, currentCount: number) => {
    setLikingClip(clipId)
    await toggleLike(clipId, currentCount)
    setTimeout(() => setLikingClip(null), 300)
  }

  const handleSave = async (clipId: number) => {
    await toggleSave(clipId)
  }

  const handleShare = async (clipId: number) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return

    const clipUrl = `${window.location.origin}/?clip=${clipId}`
    const shareText = `Check out this moment${clip.artist_name ? ` from ${clip.artist_name}` : ''}${clip.venue_name ? ` at ${clip.venue_name}` : ''} on FEEDBACK!`

    // Track share
    try {
      await fetch(`/api/clips/${clipId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform:
            typeof navigator !== 'undefined' &&
            typeof (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share ===
              'function'
              ? 'native_share'
              : 'copy_link',
        }),
      })
    } catch (err) {
      console.error('Failed to track share:', err)
    }

    // Use native share if available
    if (
      typeof navigator !== 'undefined' &&
      typeof (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share ===
        'function'
    ) {
      try {
        await navigator.share({
          title: 'Check out this FEEDBACK clip!',
          text: shareText,
          url: clipUrl,
        })
      } catch (err) {
        // User cancelled or error occurred
        console.error('Error sharing:', err)
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(clipUrl)
        alert('Link copied to clipboard!')
      } catch (err) {
        console.error('Failed to copy link:', err)
      }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} min ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  return (
    <section className="py-4 sm:py-6 md:py-8 bg-black pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
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
              ? 'Fire moments the community can\'t stop watching'
              : feedType === 'top_rated'
              ? 'The highest rated concert moments'
              : 'Fresh drops from tonight\'s shows'
            }
          </p>
        </div>

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
            <div 
              key={clipListItemKey(clip, index)}
              className="video-card bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 p-0 hover:border-purple-500/50 transition-all group flex flex-col"
            >
              {/* Square preview — 1:1 crop in the grid */}
              <div 
                className="relative w-full cursor-pointer group/video overflow-hidden bg-black aspect-square"
                onClick={() => setSelectedClip(clip)}
                onMouseEnter={() => setHoverClipId(clip.id)}
                onMouseLeave={() => setHoverClipId((id) => (id === clip.id ? null : id))}
              >
                <ClipFeedPreviewMedia
                  className="z-0"
                  playbackUrl={clip.stream_playback_url}
                  fallbackUrl={clip.video_url}
                  posterUrl={clip.stream_thumbnail_url || clip.thumbnail_url}
                  mediaHovered={hoverClipId === clip.id}
                />
                
                {/* Gradient overlays for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
                
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-10 md:h-10 lg:w-14 lg:h-14 bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal rounded-full flex items-center justify-center shadow-2xl animate-neon-pulse">
                    <div className="w-0 h-0 border-l-[18px] sm:border-l-[22px] md:border-l-[16px] border-l-white border-y-[12px] sm:border-y-[14px] md:border-y-[11px] border-y-transparent ml-0.5 sm:ml-1" />
                  </div>
                </div>

                {/* Trending badge */}
                {clip.is_trending_score >= 100 && (
                  <div className="absolute top-2 right-2 md:top-1.5 md:right-1.5 px-2 py-0.5 md:px-1.5 md:py-0.5 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full text-[10px] md:text-[10px] font-bold text-white shadow-lg animate-slide-up">
                    🔥 Trending
                  </div>
                )}

                {/* Feedback Live featured badge */}
                {clip.momentum_live_featured && (
                  <div className="absolute top-2 left-2 md:top-1.5 md:left-1.5 px-2 py-0.5 md:px-1.5 md:py-0.5 momentum-grad-interactive rounded-full text-[10px] md:text-[10px] font-bold text-white shadow-lg animate-slide-up">
                    🎬 Featured on Feedback Live
                  </div>
                )}

                {/* Removed rating badge from thumbnail - ratings shown in actions section only */}

                {/* User info overlay - top */}
                <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 md:p-1.5 lg:p-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/users/${clip.mocha_user_id}`)
                    }}
                    className="flex items-center space-x-1.5 sm:space-x-2 hover:opacity-80 transition-opacity"
                  >
                    <img 
                      src={clip.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                      alt={clip.user_display_name || 'User'}
                      className="w-8 h-8 sm:w-9 sm:h-9 md:w-6 md:h-6 lg:w-8 lg:h-8 rounded-full border-2 border-white/30 shadow-lg flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs sm:text-sm md:text-[11px] lg:text-xs drop-shadow-lg truncate">{clip.user_display_name || 'Anonymous'}</div>
                      <div className="flex items-center space-x-1 text-[10px] sm:text-xs md:text-[10px] text-white/80 drop-shadow">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                        <span className="truncate">{formatTimestamp(clip.created_at)}</span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Caption overlay - bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 md:p-1.5 lg:p-3 space-y-1 md:space-y-0.5 lg:space-y-1">
                  {clip.artist_name && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (clip.artist_name) {
                          navigate(artistPath(clip.artist_name))
                        }
                      }}
                      className="font-headline text-base sm:text-lg md:text-sm lg:text-lg text-white hover:text-purple-400 transition-colors drop-shadow-lg block text-left w-full truncate"
                    >
                      {clip.artist_name}
                    </button>
                  )}
                  {clip.venue_name && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (clip.venue_name) {
                          navigate(venuePath(clip.venue_name))
                        }
                      }}
                      className="flex items-center space-x-1 text-xs md:text-[11px] lg:text-xs text-white/90 hover:text-white transition-colors drop-shadow w-full min-w-0"
                    >
                      <MapPin className="w-3 h-3 md:w-2.5 md:h-2.5 flex-shrink-0" />
                      <span className="font-medium truncate">{clip.venue_name}</span>
                      {clip.location && <span className="text-white/70 truncate hidden sm:inline">• {clip.location}</span>}
                    </button>
                  )}
                  {clip.content_description && (
                    <p className="text-white text-xs sm:text-sm md:text-[11px] lg:text-xs leading-snug drop-shadow line-clamp-2">
                      {clip.content_description}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-2 py-2 sm:px-3 sm:py-3 md:px-2 md:py-2 lg:px-3 lg:py-3 bg-black/40">
                <div className="flex items-center justify-between w-full gap-1 sm:gap-2 md:gap-1 lg:gap-3">
                  <button 
                    onClick={() => handleLike(clip.id, clip.likes_count)}
                    className={`flex flex-col items-center space-y-0.5 transition-all group tap-feedback flex-1 min-w-0 ${
                      isLiked(clip.id) 
                        ? 'text-pink-500' 
                        : 'text-white hover:text-pink-400'
                    }`}
                  >
                    <Heart 
                      className={`w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform ${
                        isLiked(clip.id) ? 'fill-current' : ''
                      } ${likingClip === clip.id ? 'animate-heart-pop' : ''}`}
                    />
                    <span className="font-bold text-[10px] sm:text-xs">{clip.likes_count}</span>
                  </button>
                  
                  <button 
                    onClick={() => setSelectedClip(clip)}
                    className="flex flex-col items-center space-y-0.5 text-white hover:text-blue-400 transition-all group tap-feedback flex-1 min-w-0"
                  >
                    <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-[10px] sm:text-xs">{clip.comments_count}</span>
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShare(clip.id)
                    }}
                    className="flex flex-col items-center space-y-0.5 text-white hover:text-purple-400 transition-all group tap-feedback flex-1 min-w-0"
                  >
                    <Share className="w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-[10px] sm:text-xs">Share</span>
                  </button>

                  <button 
                    onClick={() => handleSave(clip.id)}
                    className={`flex flex-col items-center space-y-0.5 transition-all group tap-feedback flex-1 min-w-0 ${
                      isSaved(clip.id) 
                        ? 'text-yellow-400' 
                        : 'text-white hover:text-yellow-400'
                    }`}
                  >
                    <Bookmark 
                      className={`w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform ${
                        isSaved(clip.id) ? 'fill-current' : ''
                      }`}
                    />
                    <span className="font-bold text-[10px] sm:text-xs">Save</span>
                  </button>
                </div>
              </div>
            </div>
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
