import { Heart, MessageCircle, Share, MapPin, Clock, Bookmark } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useClips } from '@/react-app/hooks/useClips'
import { useClipLike } from '@/react-app/hooks/useClipLike'
import { useClipSave } from '@/react-app/hooks/useClipSave'
import ClipModal from './ClipModal'
import { ClipCardSkeleton } from './LoadingSkeleton'
import NetworkError from './NetworkError'
import type { ClipWithUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'

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
    const shareText = `Check out this moment${clip.artist_name ? ` from ${clip.artist_name}` : ''}${clip.venue_name ? ` at ${clip.venue_name}` : ''} on MOMENTUM!`

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
          title: 'Check out this MOMENTUM clip!',
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
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline text-white mb-2 sm:mb-3">
            {feedType === 'trending' ? 'What\'s Hot Right Now' : 
             feedType === 'top_rated' ? 'Top Rated Moments' : 
             'Live From The Scene'} <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-400 bg-clip-text text-transparent"></span>
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

        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          {error && clips.length === 0 ? (
            // Show error state on initial load failure
            <NetworkError 
              onRetry={refetch}
              message="Failed to load clips. Please check your connection and try again."
            />
          ) : loading && clips.length === 0 ? (
            // Show skeletons on initial load
            <>
              <ClipCardSkeleton />
              <ClipCardSkeleton />
              <ClipCardSkeleton />
            </>
          ) : (
            clips.map((clip, index) => (
            <div 
              key={clipListItemKey(clip, index)}
              className="video-card bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 p-0 hover:border-purple-500/50 transition-all group"
            >
              {/* Video Thumbnail - Full Width */}
              <div 
                className="relative w-full aspect-[9/16] sm:aspect-video cursor-pointer group/video overflow-hidden"
                onClick={() => setSelectedClip(clip)}
              >
                <img 
                  src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop'}
                  alt="Concert moment"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                
                {/* Gradient overlays for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
                
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity bg-black/30">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl animate-neon-pulse">
                    <div className="w-0 h-0 border-l-[24px] border-l-white border-y-[16px] border-y-transparent ml-1"></div>
                  </div>
                </div>

                {/* Trending badge */}
                {clip.is_trending_score >= 100 && (
                  <div className="absolute top-3 right-3 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full text-xs font-bold text-white shadow-lg animate-slide-up">
                    🔥 Trending
                  </div>
                )}

                {/* Momentum Live Featured badge */}
                {clip.momentum_live_featured && (
                  <div className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-xs font-bold text-white shadow-lg animate-slide-up">
                    🎬 Featured on Momentum Live
                  </div>
                )}

                {/* Removed rating badge from thumbnail - ratings shown in actions section only */}

                {/* User info overlay - top */}
                <div className="absolute top-0 left-0 right-0 p-3 sm:p-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/users/${clip.mocha_user_id}`)
                    }}
                    className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                  >
                    <img 
                      src={clip.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                      alt={clip.user_display_name || 'User'}
                      className="w-10 h-10 rounded-full border-2 border-white/30 shadow-lg"
                    />
                    <div>
                      <div className="font-bold text-white text-sm drop-shadow-lg">{clip.user_display_name || 'Anonymous'}</div>
                      <div className="flex items-center space-x-1 text-xs text-white/80 drop-shadow">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(clip.created_at)}</span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Caption overlay - bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 space-y-2">
                  {clip.artist_name && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (clip.artist_name) {
                          navigate(`/artists/${encodeURIComponent(clip.artist_name)}`)
                        }
                      }}
                      className="font-headline text-xl sm:text-2xl text-white hover:text-purple-400 transition-colors drop-shadow-lg block"
                    >
                      {clip.artist_name}
                    </button>
                  )}
                  {clip.venue_name && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (clip.venue_name) {
                          navigate(`/venues/${encodeURIComponent(clip.venue_name)}`)
                        }
                      }}
                      className="flex items-center space-x-1 text-sm text-white/90 hover:text-white transition-colors drop-shadow"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="font-medium">{clip.venue_name}</span>
                      {clip.location && <span className="text-white/70">• {clip.location}</span>}
                    </button>
                  )}
                  {clip.content_description && (
                    <p className="text-white text-sm sm:text-base leading-snug drop-shadow line-clamp-2">
                      {clip.content_description}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 bg-black/40">
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <button 
                    onClick={() => handleLike(clip.id, clip.likes_count)}
                    className={`flex flex-col items-center space-y-1 transition-all group tap-feedback ${
                      isLiked(clip.id) 
                        ? 'text-pink-500' 
                        : 'text-white hover:text-pink-400'
                    }`}
                  >
                    <Heart 
                      className={`w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform ${
                        isLiked(clip.id) ? 'fill-current' : ''
                      } ${likingClip === clip.id ? 'animate-heart-pop' : ''}`}
                    />
                    <span className="font-bold text-xs">{clip.likes_count}</span>
                  </button>
                  
                  <button 
                    onClick={() => setSelectedClip(clip)}
                    className="flex flex-col items-center space-y-1 text-white hover:text-blue-400 transition-all group tap-feedback"
                  >
                    <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">{clip.comments_count}</span>
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShare(clip.id)
                    }}
                    className="flex flex-col items-center space-y-1 text-white hover:text-purple-400 transition-all group tap-feedback"
                  >
                    <Share className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">Share</span>
                  </button>

                  <button 
                    onClick={() => handleSave(clip.id)}
                    className={`flex flex-col items-center space-y-1 transition-all group tap-feedback ${
                      isSaved(clip.id) 
                        ? 'text-yellow-400' 
                        : 'text-white hover:text-yellow-400'
                    }`}
                  >
                    <Bookmark 
                      className={`w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform ${
                        isSaved(clip.id) ? 'fill-current' : ''
                      }`}
                    />
                    <span className="font-bold text-xs">Save</span>
                  </button>
                </div>
              </div>
            </div>
          )))
          }
        </div>

        {/* Infinite scroll trigger */}
        <div ref={observerTarget} className="h-10 flex items-center justify-center mt-8">
          {loading && (
            <div className="text-cyan-400 text-sm font-medium">Loading more moments...</div>
          )}
          {!loading && !hasMore && clips.length > 0 && (
            <div className="text-gray-500 text-sm">You've reached the end</div>
          )}
        </div>

        {clips.length === 0 && !loading && !error && (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border border-purple-500/20 rounded-xl p-8 space-y-4">
              <div className="text-6xl mb-4">🎸</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                No Clips Yet
              </h3>
              <p className="text-gray-300 mb-6">
                Be the first to drop a moment from tonight's show!
              </p>
              <button
                onClick={() => navigate('/upload')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
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
        />
      )}

    </section>
  )
}
