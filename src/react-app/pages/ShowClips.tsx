import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Calendar, MapPin, Star, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { apiArtistPath, artistPath } from '@/shared/app-paths';

export default function ShowClipsPage() {
  const { artistName, showId } = useParams<{ artistName: string; showId: string }>();
  const navigate = useNavigate();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'time_posted' | 'clip_rating'>('time_posted');
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);

  useEffect(() => {
    fetchShowClips();
  }, [artistName, showId, sortBy]);

  const fetchShowClips = async () => {
    if (!artistName || !showId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${apiArtistPath(artistName)}/shows/${showId}/clips?sort_by=${sortBy}`
      );
      if (response.ok) {
        const data = await response.json();
        setClips(data.clips || []);
      }
    } catch (error) {
      console.error('Failed to fetch show clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const showDate = clips.length > 0 && clips[0].timestamp 
    ? new Date(clips[0].timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const venueName = clips.length > 0 ? clips[0].venue_name : '';
  const location = clips.length > 0 ? clips[0].location : '';

  const averageRating = clips.length > 0
    ? clips.reduce((sum, clip) => sum + ((clip as any).average_rating || 0), 0) / clips.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <button
          onClick={() => navigate(artistName ? artistPath(artistName) : '/')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to {decodeURIComponent(artistName || '')}</span>
        </button>

        {/* Show Header */}
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-xl p-6 sm:p-8 mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            {decodeURIComponent(artistName || '')}
          </h1>
          
          <div className="flex flex-wrap gap-4 text-gray-300 mb-4">
            {showDate && (
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>{showDate}</span>
              </div>
            )}
            {venueName && (
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                <span>{venueName}</span>
                {location && <span className="text-gray-500">• {location}</span>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <span className="text-gray-400">
                {clips.length} moment{clips.length !== 1 ? 's' : ''}
              </span>
              {averageRating > 0 && (
                <div className="flex items-center space-x-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="text-white font-medium">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-400">average rating</span>
                </div>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'time_posted' | 'clip_rating')}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400"
            >
              <option value="time_posted">Time Posted</option>
              <option value="clip_rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Clips Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-12 bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl">
            <p className="text-gray-400 text-lg">No clips found for this show</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clips.map((clip, index) => (
              <div
                key={clipListItemKey(clip, index)}
                onClick={() => setSelectedClip(clip)}
                className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl overflow-hidden hover:border-purple-400/50 transition-all cursor-pointer group"
              >
                <div className="relative aspect-video">
                  <img
                    src={
                      clip.thumbnail_url ||
                      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
                    }
                    alt="Concert moment"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  
                  {/* Rating badge */}
                  {(clip as any).average_rating > 0 && (
                    <div className="absolute top-3 right-3 flex items-center space-x-1 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-full">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white text-sm font-medium">
                        {(clip as any).average_rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {clip.content_description && (
                    <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                      {clip.content_description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{clip.likes_count} likes</span>
                    <span>{clip.views_count} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedClip && (
        <ClipModal clip={selectedClip} onClose={() => setSelectedClip(null)} />
      )}
    </div>
  );
}
