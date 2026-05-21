import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Disc3, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import { apiGlobalSongPath } from '@/shared/app-paths';

type GlobalSongPageData = {
  song: { title: string; slug: string };
  clipCount: number;
};

export default function GlobalSongPage() {
  const { songSlug } = useParams<{ songSlug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<GlobalSongPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!songSlug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiGlobalSongPath(songSlug));
        if (!res.ok) {
          throw new Error('Song not found');
        }
        const json = (await res.json()) as GlobalSongPageData;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load song');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [songSlug]);

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/discover')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Discover</span>
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
                  <p className="text-gray-400 text-sm">
                    {data.clipCount} moment{data.clipCount === 1 ? '' : 's'} tagged with this track
                  </p>
                </div>
              </div>
            </div>

            <ConcertFeed
              feedType="latest"
              songSlug={data.song.slug}
              hideSectionHeader
              edgeBleed
              edgeBleedScope="page"
            />
          </>
        )}
      </div>
    </div>
  );
}
