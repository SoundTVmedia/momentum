import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bookmark, Loader2 } from 'lucide-react';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import SectionHeading from '@/react-app/components/SectionHeading';
import type { ClipWithUser } from '@/shared/types';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { SAVED_CLIPS_CHANGED_EVENT } from '@/react-app/lib/savedClipsEvents';

export default function SavedClipsSection() {
  const navigate = useNavigate();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [savedModalFeed, setSavedModalFeed] = useState<ClipWithUser[] | null>(null);

  const fetchSavedClips = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/me/saved-clips', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch saved clips');
      }
      const data = (await response.json()) as { clips?: ClipWithUser[] };
      setClips(data.clips ?? []);
    } catch (error) {
      console.error('Error fetching saved clips:', error);
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSavedClips();
  }, [fetchSavedClips]);

  useEffect(() => {
    const onChanged = () => {
      void fetchSavedClips();
    };
    window.addEventListener(SAVED_CLIPS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SAVED_CLIPS_CHANGED_EVENT, onChanged);
  }, [fetchSavedClips]);

  const closeModal = () => {
    setSelectedClip(null);
    setSavedModalFeed(null);
    void fetchSavedClips();
  };

  return (
    <section aria-label="Saved clips">
      <SectionHeading
        title="Saved clips"
        subtitle="Clips you bookmarked from the feed or clip player"
        icon={Bookmark}
        iconClassName="text-momentum-ember"
        badge={
          !loading && clips.length > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full bg-momentum-ember/15 text-momentum-ember text-xs font-medium">
              {clips.length}
            </span>
          ) : null
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" aria-label="Loading saved clips" />
        </div>
      ) : clips.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center border border-momentum-ember/20">
          <Bookmark className="w-12 h-12 text-gray-600 mx-auto mb-4" aria-hidden />
          <p className="text-gray-300 mb-2">No saved clips yet</p>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Tap the bookmark on any clip in the feed or player to save it here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-105 transition-transform"
          >
            Explore the feed
          </button>
        </div>
      ) : (
        <ClipFeedCarousel
          clips={clips}
          className={PAGE_CAROUSEL_BLEED}
          ariaLabel="Saved clips"
          onOpenClip={(clip) => {
            setSelectedClip(clip);
            setSavedModalFeed(clips.length > 1 ? clips : null);
          }}
        />
      )}

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={closeModal}
          feedNavigation={
            savedModalFeed && savedModalFeed.length > 1
              ? { clips: savedModalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      ) : null}
    </section>
  );
}
