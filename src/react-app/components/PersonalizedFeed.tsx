import { Loader2, Heart, Sparkles, RefreshCw } from 'lucide-react';
import { usePersonalizedFeed } from '@/react-app/hooks/usePersonalizedFeed';
import ClipModal from '@/react-app/components/ClipModal';
import { useState } from 'react';

export default function PersonalizedFeed() {
  const { clips, loading, error, personalized, hasMore, loadMore, refresh } = usePersonalizedFeed();
  const [selectedClip, setSelectedClip] = useState<any | null>(null);

  if (loading && clips.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading your personalized feed...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (!personalized || clips.length === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border border-purple-500/20 rounded-xl p-8">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            Personalize Your Feed
          </h3>
          <p className="text-gray-300 mb-4">
            Complete your profile with favorite artists and home location to see personalized content!
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
          >
            Update Preferences
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Heart className="w-6 h-6 text-pink-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">
              For You
            </h2>
            <p className="text-gray-400 text-sm">
              Moments from artists you love and shows near you
            </p>
          </div>
        </div>
        
        <button
          onClick={refresh}
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {clips.map((clip) => (
          <button
            key={clip.id}
            onClick={() => setSelectedClip(clip)}
            className="group relative aspect-[9/16] bg-black/40 rounded-xl overflow-hidden hover:scale-105 transition-transform"
          >
            {/* Thumbnail */}
            <img
              src={clip.thumbnail_url || clip.stream_thumbnail_url || '/placeholder-thumbnail.jpg'}
              alt={clip.artist_name || 'Concert clip'}
              className="w-full h-full object-cover"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-bold text-sm mb-1 truncate">
                  {clip.artist_name || 'Unknown Artist'}
                </h3>
                <p className="text-gray-300 text-xs truncate">
                  {clip.venue_name || clip.location || 'Unknown Venue'}
                </p>
                <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                  <span>❤️ {clip.likes_count}</span>
                  <span>👁️ {clip.views_count}</span>
                </div>
              </div>
            </div>

            {/* Personalization indicator */}
            {(clip.artist_score || clip.location_score) && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-pink-500 rounded-full">
                <Heart className="w-3 h-3 text-white fill-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </span>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}

      {/* Clip Modal */}
      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
        />
      )}
    </div>
  );
}
