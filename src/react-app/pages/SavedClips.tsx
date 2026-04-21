import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Bookmark, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import type { ClipWithUser } from '@/shared/types';

export default function SavedClips() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/');
    } else if (user) {
      fetchSavedClips();
    }
  }, [user, isPending, navigate]);

  const fetchSavedClips = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/me/saved-clips');
      if (!response.ok) {
        throw new Error('Failed to fetch saved clips');
      }
      const data = await response.json();
      setClips(data.clips || []);
    } catch (error) {
      console.error('Error fetching saved clips:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isPending || (loading && user)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Bookmark className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Saved Clips</h1>
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full font-medium">
              {clips.length} clips
            </span>
          </div>
          <p className="text-gray-300 text-lg">Your bookmarked concert moments</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-12 bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl">
            <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No saved clips yet</p>
            <p className="text-gray-500 mt-2">Click the bookmark icon on any clip to save it here</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
            >
              Explore Clips
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {clips.map((clip) => (
              <div 
                key={clip.id}
                onClick={() => setSelectedClip(clip)}
                className="bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6 hover:border-yellow-400/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={clip.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                      alt={clip.user_display_name || 'User'}
                      className="w-10 h-10 rounded-full border-2 border-yellow-500/40"
                    />
                    <div>
                      <div className="font-medium text-white">{clip.user_display_name || 'Anonymous'}</div>
                      <div className="text-sm text-gray-400">
                        Saved {new Date(clip.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {clip.artist_name && (
                      <div className="font-bold text-purple-400">{clip.artist_name}</div>
                    )}
                    {clip.venue_name && (
                      <div className="text-sm text-gray-400">{clip.venue_name}</div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <div 
                    className="relative mb-4 rounded-lg overflow-hidden group-hover:scale-[1.02] transition-transform"
                  >
                    <img 
                      src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                      alt="Concert moment"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="bg-white/20 backdrop-blur-lg rounded-full p-3 hover:scale-110 transition-transform">
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[6px] border-l-black border-y-[4px] border-y-transparent ml-0.5"></div>
                        </div>
                      </button>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Bookmark className="w-6 h-6 text-yellow-400 fill-current" />
                    </div>
                  </div>
                  {clip.content_description && (
                    <p className="text-gray-200 leading-relaxed">{clip.content_description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center space-x-4">
                    <span>{clip.likes_count} likes</span>
                    <span>{clip.comments_count} comments</span>
                    <span>{clip.views_count} views</span>
                  </div>
                  <span>Click to watch</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedClip && (
        <ClipModal 
          clip={selectedClip} 
          onClose={() => setSelectedClip(null)} 
        />
      )}
    </div>
  );
}
