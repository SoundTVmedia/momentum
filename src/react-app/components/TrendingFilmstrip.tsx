import { Flame, Play } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useClips } from '@/react-app/hooks/useClips'
import type { ClipWithUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'

export default function TrendingFilmstrip() {
  const navigate = useNavigate()
  const { clips, loading } = useClips({ feedType: 'trending', limit: 12 })

  const handleClipClick = (clip: ClipWithUser) => {
    // Navigate to the main feed where they can view the clip in the modal
    navigate('/', { state: { selectedClip: clip } })
  }

  return (
    <section className="relative pt-4 pb-8 sm:pb-10 md:pb-12">
      {/* Prominent background accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-pink-600/5 to-purple-600/5" />
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="relative">
              <Flame className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-500 animate-pulse" />
              <div className="absolute inset-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-orange-500/30 rounded-full blur-lg animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 bg-clip-text text-transparent">
              Trending Moments
            </h2>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm font-medium transition-colors"
          >
            View All
          </button>
        </div>

        {loading && clips.length === 0 ? (
          <div className="flex space-x-3 sm:space-x-4 overflow-x-auto pb-4 scrollbar-hide">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-shrink-0 w-40 sm:w-48 md:w-56 animate-pulse">
                <div className="aspect-[4/3] bg-white/10 rounded-lg mb-2" />
                <div className="h-3 bg-white/10 rounded mb-1" />
                <div className="h-2 bg-white/10 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Horizontal scrolling container */}
            <div className="flex space-x-3 sm:space-x-4 md:space-x-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
              {clips.map((clip, index) => (
                <button
                  key={clipListItemKey(clip, index)}
                  onClick={() => handleClipClick(clip)}
                  className="flex-shrink-0 w-40 sm:w-48 md:w-56 group cursor-pointer snap-start"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-2 sm:mb-3 border border-white/10 group-hover:border-purple-500/50 transition-all bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
                    <img
                      src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                      alt={clip.artist_name || 'Concert moment'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Trending badge */}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full text-xs font-bold text-white shadow-lg flex items-center space-x-1">
                      <Flame className="w-3 h-3" />
                      <span className="hidden sm:inline">Hot</span>
                    </div>

                    {/* Stats overlay - no ratings shown */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center justify-between text-white text-xs">
                        <span className="font-bold">{clip.likes_count > 999 ? `${(clip.likes_count / 1000).toFixed(1)}k` : clip.likes_count} ❤️</span>
                        <span className="font-bold">{clip.views_count > 999 ? `${(clip.views_count / 1000).toFixed(1)}k` : clip.views_count} 👁️</span>
                      </div>
                    </div>
                  </div>

                  {/* Clip info */}
                  <div className="text-left px-1">
                    {clip.artist_name && (
                      <h3 className="text-white font-bold text-xs sm:text-sm truncate group-hover:text-cyan-400 transition-colors">
                        {clip.artist_name}
                      </h3>
                    )}
                    {clip.venue_name && (
                      <p className="text-gray-400 text-[10px] sm:text-xs truncate">
                        {clip.venue_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Scroll indicators (desktop only) */}
            <div className="hidden md:block absolute top-1/2 -translate-y-1/2 left-0 w-8 h-full bg-gradient-to-r from-black to-transparent pointer-events-none" />
            <div className="hidden md:block absolute top-1/2 -translate-y-1/2 right-0 w-8 h-full bg-gradient-to-l from-black to-transparent pointer-events-none" />
          </div>
        )}

        {clips.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-400">No trending clips right now. Be the first to post!</p>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  )
}
