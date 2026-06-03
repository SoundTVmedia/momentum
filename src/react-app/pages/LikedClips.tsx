import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Heart, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import type { ClipWithUser } from '@/shared/types';
import { PAGE_BLOCK_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

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
        <div className={PAGE_BLOCK_CLASS}>
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
          <ClipFeedCarousel
            clips={clips}
            className={PAGE_CAROUSEL_BLEED}
            ariaLabel="Liked clips"
            onOpenClip={(clip) => {
              setSelectedClip(clip);
              setLikedModalFeed(clips.length > 1 ? clips : null);
            }}
          />
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
