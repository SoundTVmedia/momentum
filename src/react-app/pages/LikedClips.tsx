import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Heart, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import UserAvatar from '@/react-app/components/UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';

export default function LikedClips() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [likedModalFeed, setLikedModalFeed] = useState<ClipWithUser[] | null>(null);

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth');
    } else if (user) {
      void fetchLikedClips();
    }
  }, [user, isPending, navigate]);

  const fetchLikedClips = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/me/liked-clips-feed', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch liked clips');
      }
      const data = (await response.json()) as { clips?: ClipWithUser[] };
      setClips(data.clips || []);
    } catch (error) {
      console.error('Error fetching liked clips:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isPending || (loading && user)) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Heart className="w-8 h-8 text-red-400" />
            <h1 className="text-4xl font-bold text-white">Liked Clips</h1>
            <span className="px-3 py-1 bg-red-500/15 text-red-300 text-sm rounded-full font-medium">
              {clips.length} clips
            </span>
          </div>
          <p className="text-gray-300 text-lg">Moments you&apos;ve liked across the feed</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-12 glass-panel border border-momentum-ember/20 rounded-xl">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No liked clips yet</p>
            <p className="text-gray-500 mt-2">Tap the heart on any clip to save it here</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform"
            >
              Explore Clips
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {clips.map((clip, index) => (
              <div
                key={clipListItemKey(clip, index)}
                onClick={() => {
                  setSelectedClip(clip);
                  setLikedModalFeed(clips.length > 1 ? clips : null);
                }}
                className="glass-panel border border-momentum-ember/20 rounded-xl p-6 hover:border-momentum-ember/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <UserAvatar
                      imageUrl={clip.user_avatar}
                      displayName={clip.user_display_name}
                      seed={clip.mocha_user_id}
                      alt={clip.user_display_name || 'User'}
                      sizeClass="w-10 h-10"
                      letterClassName="text-sm font-semibold"
                      className="border-2 border-momentum-ember/35"
                    />
                    <div>
                      <div className="font-medium text-white">{clip.user_display_name || 'Anonymous'}</div>
                      <div className="text-sm text-gray-400">
                        {clip.artist_name || clip.venue_name || 'Concert moment'}
                      </div>
                    </div>
                  </div>
                  <Heart className="w-5 h-5 text-red-400 fill-current shrink-0" aria-hidden />
                </div>

                <div className="mb-4">
                  <div className="relative mb-4 rounded-lg overflow-hidden group-hover:scale-[1.02] transition-transform">
                    <img
                      src={
                        clip.thumbnail_url ||
                        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
                      }
                      alt=""
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/20 backdrop-blur-lg rounded-full p-3">
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[6px] border-l-black border-y-[4px] border-y-transparent ml-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {clip.content_description ? (
                    <p className="text-gray-200 leading-relaxed line-clamp-2">{clip.content_description}</p>
                  ) : null}
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

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => {
            setSelectedClip(null);
            setLikedModalFeed(null);
          }}
          feedNavigation={
            likedModalFeed && likedModalFeed.length > 1
              ? { clips: likedModalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      ) : null}
    </div>
  );
}
