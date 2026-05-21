import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Music, Loader2, Disc3 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import type { ClipWithUser } from '@/shared/types';
import { artistPath, apiSongPath } from '@/shared/app-paths';

type SongPageData = {
  artist: { name: string; slug: string };
  song: { title: string; slug: string };
  clips: ClipWithUser[];
  clipCount: number;
};

export default function SongPage() {
  const { artistName, songSlug } = useParams<{ artistName: string; songSlug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SongPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!artistName || !songSlug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiSongPath(artistName, songSlug));
        if (!res.ok) {
          throw new Error('Song not found');
        }
        const json = (await res.json()) as SongPageData;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load song');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [artistName, songSlug]);

  const modalFeed =
    data && data.clips.length > 1
      ? {
          clips: data.clips,
          onChangeClip: setSelectedClip,
        }
      : null;

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate(data ? artistPath(data.artist.name) : '/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to {data?.artist.name ?? decodeURIComponent(artistName || 'artist')}</span>
        </button>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : error || !data ? (
          <p className="text-center text-gray-400 py-16">{error ?? 'Song not found'}</p>
        ) : (
          <>
            <div className="mb-10 rounded-2xl border border-momentum-rose/30 bg-gradient-to-r from-momentum-rose/25 to-momentum-ink/15 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-momentum-rose/20 flex items-center justify-center shrink-0">
                  <Disc3 className="w-8 h-8 text-momentum-rose/80" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-wide text-momentum-rose/80/90 mb-1">Song</p>
                  <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white mb-2 truncate">
                    {data.song.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => navigate(artistPath(data.artist.name))}
                    className="inline-flex items-center gap-2 text-momentum-flare/90 hover:text-momentum-flare transition-colors"
                  >
                    <Music className="w-4 h-4" />
                    <span className="font-medium">{data.artist.name}</span>
                  </button>
                  <p className="text-gray-400 text-sm mt-3">
                    {data.clipCount} moment{data.clipCount === 1 ? '' : 's'} tagged with this track
                  </p>
                </div>
              </div>
            </div>

            {data.clips.length > 0 ? (
              <ClipFeedCarousel
                clips={data.clips}
                onOpenClip={(clip) => {
                  setSelectedClip(clip);
                }}
                ariaLabel={`Clips for ${data.song.title}`}
              />
            ) : (
              <p className="text-center text-gray-400 py-12">
                No clips for this song yet. Upload a moment with song ID enabled.
              </p>
            )}
          </>
        )}
      </div>

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          feedNavigation={modalFeed}
        />
      ) : null}
    </div>
  );
}
