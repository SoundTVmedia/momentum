import { MapPin, Radio, Users, Star, Calendar, Loader2, Navigation } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { usePrioritizedShows } from '@/react-app/hooks/usePrioritizedShows'
import { useAuth } from '@getmocha/users-service/react'
import { artistPath, venuePath } from '@/shared/app-paths'

export default function DiscoverSection() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { shows, loading, hasLocation, requestUserLocation } = usePrioritizedShows()
  const [filter, setFilter] = useState<'all' | 'live' | 'nearby' | 'favorites'>('all')

  // Filter shows based on selected filter
  const filteredShows = shows.filter(show => {
    if (filter === 'all') return true
    if (filter === 'live') return show.type === 'live'
    if (filter === 'nearby') return show.type === 'nearby_upcoming'
    if (filter === 'favorites') return show.is_favorite
    return true
  })

  const handleShowClick = (show: any) => {
    if (show.type === 'live') {
      // Navigate to venue page for live shows
      navigate(venuePath(show.venue_name))
    } else if (show.type === 'upcoming_favorite' || show.type === 'nearby_upcoming') {
      // Navigate to artist page for upcoming shows
      navigate(artistPath(show.artist_name))
    } else if (show.type === 'favorite_artist') {
      // Navigate to artist page
      navigate(artistPath(show.artist_name))
    } else if (show.type === 'trending' && show.clip) {
      // Could open clip modal or navigate to artist
      navigate(artistPath(show.clip.artist_name))
    }
  }

  const getPriorityLabel = (show: any) => {
    if (show.type === 'live') return 'LIVE NOW'
    if (show.type === 'nearby_upcoming') return 'NEAR YOU'
    if (show.is_favorite) return 'FAVORITE'
    if (show.type === 'trending') return 'TRENDING'
    return null
  }

  const getPriorityColor = (show: any) => {
    if (show.type === 'live') return 'from-red-500 to-orange-500'
    if (show.type === 'nearby_upcoming') return 'from-green-500 to-emerald-500'
    if (show.is_favorite) return 'from-purple-500 to-pink-500'
    if (show.type === 'trending') return 'from-orange-500 to-yellow-500'
    return 'from-cyan-500 to-blue-500'
  }

  return (
    <section className="pt-8 pb-20 bg-gradient-to-b from-black to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Find <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Your Next Show</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto font-medium">
            See who's playing near you and join the scene
          </p>
        </div>

        {/* Location Request Banner */}
        {user && !hasLocation && (
          <div className="mb-8 p-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-lg border border-cyan-500/40 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Navigation className="w-6 h-6 text-cyan-400" />
                <div>
                  <h3 className="text-white font-semibold">Enable Location for Nearby Shows</h3>
                  <p className="text-sm text-gray-300">See concerts happening within 60 miles of you</p>
                </div>
              </div>
              <button
                onClick={requestUserLocation}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-medium hover:scale-105 transition-transform"
              >
                Enable Location
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full font-medium transition-all ${
              filter === 'all'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-cyan-500/20 hover:border-cyan-400/40'
            }`}
          >
            All Shows
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`px-4 py-2 rounded-full font-medium transition-all ${
              filter === 'live'
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-red-500/20 hover:border-red-400/40'
            }`}
          >
            <div className="flex items-center space-x-1">
              <Radio className="w-4 h-4" />
              <span>Live Now</span>
            </div>
          </button>
          {hasLocation && (
            <button
              onClick={() => setFilter('nearby')}
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                filter === 'nearby'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-green-500/20 hover:border-green-400/40'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Navigation className="w-4 h-4" />
                <span>Near You</span>
              </div>
            </button>
          )}
          {user && (
            <button
              onClick={() => setFilter('favorites')}
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                filter === 'favorites'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-purple-500/20 hover:border-purple-400/40'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4" />
                <span>Favorites</span>
              </div>
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Finding the best shows for you...</p>
          </div>
        )}

        {/* Shows Grid */}
        {!loading && filteredShows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredShows.map((show, index) => {
              const priorityLabel = getPriorityLabel(show)
              const priorityColor = getPriorityColor(show)
              const imageUrl = show.artist_image || show.clip?.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop'

              return (
                <div
                  key={`${show.type}-${index}`}
                  onClick={() => handleShowClick(show)}
                  className="group bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/50 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  <div className="relative">
                    <img
                      src={imageUrl}
                      alt={show.artist_name || 'Concert'}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                    {/* Priority Badge */}
                    {priorityLabel && (
                      <div className="absolute top-3 left-3">
                        <span className={`px-3 py-1 bg-gradient-to-r ${priorityColor} rounded-full text-xs text-white font-bold shadow-lg`}>
                          {priorityLabel}
                        </span>
                      </div>
                    )}

                    {/* Live Indicator */}
                    {show.is_live && (
                      <div className="absolute top-3 right-3 flex items-center space-x-1 bg-black/60 backdrop-blur-lg rounded-full px-2 py-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-400 text-xs font-medium">LIVE</span>
                      </div>
                    )}

                    {/* Distance Badge */}
                    {show.distance_miles && (
                      <div className="absolute bottom-3 right-3">
                        <span className="px-2 py-1 bg-black/60 backdrop-blur-lg rounded-full text-xs text-white font-medium">
                          {Math.round(show.distance_miles)} mi
                        </span>
                      </div>
                    )}

                    {/* Moments Count - Positioned for Live Shows */}
                    {show.is_live && show.moments_count && show.moments_count > 0 && (
                      <div className="absolute bottom-3 left-3 flex items-center space-x-1 bg-black/60 backdrop-blur-lg rounded-full px-2 py-1">
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span className="text-white text-xs font-medium">{show.moments_count} moments</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="font-bold text-xl text-white mb-2 group-hover:text-cyan-400 transition-colors truncate">
                      {show.artist_name || 'Artist'}
                    </h3>

                    <div className="space-y-2 mb-4">
                      {show.venue_name && (
                        <div className="flex items-start space-x-2 text-gray-300 text-sm">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{show.venue_name}</div>
                            {(show.venue_location || show.location) && (
                              <div className="text-xs text-gray-400 truncate">
                                {show.venue_location || show.location}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Show moments count for live shows */}
                      {show.is_live && show.moments_count && (
                        <div className="flex items-center space-x-2 text-cyan-400 text-sm font-medium">
                          <Users className="w-4 h-4" />
                          <span>{show.moments_count} moments shared</span>
                        </div>
                      )}

                      {show.date && !show.is_live && (
                        <div className="flex items-center space-x-2 text-gray-300 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(show.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {show.type === 'live' && show.venue_name ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (show.venue_name) {
                              navigate(venuePath(show.venue_name));
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg text-white font-medium hover:scale-105 transition-transform"
                        >
                          Join Show Now
                        </button>
                      ) : show.ticket_url ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(show.ticket_url, '_blank');
                          }}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-medium hover:scale-105 transition-transform"
                        >
                          Get Tickets
                        </button>
                      ) : (
                        <button className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-medium hover:bg-white/20 transition-colors">
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredShows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No shows found matching your filters.</p>
            <button
              onClick={() => setFilter('all')}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-medium hover:scale-105 transition-transform"
            >
              View All Shows
            </button>
          </div>
        )}

        <div className="text-center mt-12">
          <button
            onClick={() => navigate('/discover')}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform hover:shadow-lg hover:shadow-cyan-500/25"
          >
            Explore More Shows
          </button>
        </div>
      </div>
    </section>
  )
}
