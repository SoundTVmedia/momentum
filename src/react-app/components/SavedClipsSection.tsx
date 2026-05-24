import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import SectionHeading from '@/react-app/components/SectionHeading';
import type { ClipWithUser } from '@/shared/types';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
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

  const sectionHeader = (
    <SectionHeading
      title="Saved clips"
      subtitle="Clips you bookmarked from the feed or clip player"
      size="section"
    />
  );

  if (loading) {
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        {sectionHeader}
        <div className="glass-panel rounded-xl p-8">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            <span>Loading saved clips…</span>
          </div>
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        {sectionHeader}
        <div className="glass-highlight rounded-xl p-8">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">No saved clips yet</h3>
            <p className="text-gray-300 mb-4 max-w-md mx-auto">
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
        </div>
      </div>
    );
  }

  return (
    <div className={HOME_FEED_SECTION_CLASS}>
      {sectionHeader}
      <ClipFeedCarousel
        clips={clips}
        className={HOME_FEED_CAROUSEL_BLEED}
        ariaLabel="Saved clips"
        onOpenClip={(clip) => {
          setSelectedClip(clip);
          setSavedModalFeed(clips.length > 1 ? clips : null);
        }}
      />

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
    </div>
  );
}
