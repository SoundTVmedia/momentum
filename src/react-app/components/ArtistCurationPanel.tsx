import { useState, useEffect } from 'react';
import { Star, Pin, Eye, Heart, MessageCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';

export default function ArtistCurationPanel() {
  const { user } = useAuth();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinnedClips, setPinnedClips] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchFanSubmissions();
    fetchPinnedClips();
  }, []);

  const fetchFanSubmissions = async () => {
    try {
      setLoading(true);
      // Get clips tagged to this artist
      const response = await fetch(`/api/clips?user_id=${user?.id}`);
      const data = await response.json();
      setClips(data.clips || []);
    } catch (error) {
      console.error('Failed to fetch fan submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPinnedClips = async () => {
    try {
      // Fetch pinned clips for this artist (would need backend endpoint)
      const response = await fetch(`/api/artists/me/pinned-clips`);
      if (response.ok) {
        const data = await response.json();
        setPinnedClips(new Set(data.pinnedClipIds || []));
      }
    } catch (error) {
      console.error('Failed to fetch pinned clips:', error);
    }
  };

  const togglePinClip = async (clipId: number) => {
    try {
      const isPinned = pinnedClips.has(clipId);
      const method = isPinned ? 'DELETE' : 'POST';
      
      const response = await fetch(`/api/artists/me/pinned-clips/${clipId}`, {
        method,
      });

      if (response.ok) {
        setPinnedClips((prev) => {
          const next = new Set(prev);
          if (isPinned) {
            next.delete(clipId);
          } else {
            next.add(clipId);
          }
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Fan Submissions</h2>
        <div className="text-sm text-gray-400">
          {clips.length} clips • {pinnedClips.size} pinned
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="text-center py-12">
          <Star className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No fan submissions yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clips.map((clip) => {
            const isPinned = pinnedClips.has(clip.id);
            
            return (
              <div
                key={clip.id}
                className={`p-4 rounded-lg border transition-all ${
                  isPinned
                    ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start space-x-4">
                  {/* Thumbnail */}
                  <img
                    src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&h=120&fit=crop'}
                    alt="Clip thumbnail"
                    className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium mb-1 truncate">
                          {clip.content_description || 'Untitled clip'}
                        </div>
                        <div className="text-gray-400 text-sm">
                          by {clip.user_display_name || 'Anonymous'}
                        </div>
                      </div>
                      
                      {isPinned && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400 text-xs font-medium ml-2">
                          <Pin className="w-3 h-3" />
                          <span>Pinned</span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                      <div className="flex items-center space-x-1">
                        <Eye className="w-4 h-4" />
                        <span>{formatNumber(clip.views_count)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Heart className="w-4 h-4" />
                        <span>{formatNumber(clip.likes_count)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{formatNumber(clip.comments_count)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => togglePinClip(clip.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isPinned
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
                            : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                        }`}
                      >
                        {isPinned ? (
                          <span className="flex items-center space-x-1">
                            <Pin className="w-4 h-4" />
                            <span>Unpin</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1">
                            <Pin className="w-4 h-4" />
                            <span>Pin to Hub</span>
                          </span>
                        )}
                      </button>
                      
                      <button className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-colors">
                        View Clip
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
