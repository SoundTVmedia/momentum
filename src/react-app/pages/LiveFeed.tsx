import { useEffect, useRef, useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import { useNavigate } from 'react-router';
import ClipModal from '@/react-app/components/ClipModal';
import Header from '@/react-app/components/Header';
import { useClips } from '@/react-app/hooks/useClips';
import type { ClipWithUser } from '@/shared/types';

/** Opens the latest "From the Scene" clip directly in the full player. */
export default function LiveFeedPage() {
  const navigate = useNavigate();
  const { clips, loading, error, refresh } = useClips({
    feedType: 'latest',
    limit: 24,
    enablePolling: true,
  });
  const viewedFallback = useClips({
    feedType: 'most_viewed',
    limit: 24,
  });
  const sceneClips = clips.length > 0 ? clips : viewedFallback.clips;
  const sceneLoading = clips.length > 0 ? loading : loading || viewedFallback.loading;
  const sceneError = clips.length > 0 ? error : error && viewedFallback.error;
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current || sceneClips.length === 0) return;
    openedRef.current = true;
    setSelectedClip(sceneClips[0] ?? null);
  }, [sceneClips]);

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-16 text-center">
        {sceneLoading && sceneClips.length === 0 ? (
          <div>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-momentum-flare" />
            <p className="mt-4 text-gray-400">Opening the latest clip…</p>
          </div>
        ) : sceneError && sceneClips.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8">
            <p className="text-red-300">{sceneError}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-5 rounded-xl momentum-grad-interactive px-5 py-2.5 font-semibold"
            >
              Try again
            </button>
          </div>
        ) : sceneClips.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8">
            <Radio className="mx-auto h-10 w-10 text-momentum-flare" />
            <h1 className="mt-4 text-2xl font-bold">Live Feed</h1>
            <p className="mt-2 text-gray-400">Loading moments from the scene…</p>
          </div>
        ) : null}
      </main>

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => navigate('/browse/clips/latest')}
          feedNavigation={{ clips: sceneClips, onChangeClip: setSelectedClip }}
        />
      ) : null}
    </div>
  );
}
