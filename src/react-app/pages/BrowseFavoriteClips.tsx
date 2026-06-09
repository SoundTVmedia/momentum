import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import Header from '@/react-app/components/Header';
import ClipsInfiniteGrid from '@/react-app/components/ClipsInfiniteGrid';
import type { ClipWithUser } from '@/shared/types';
import { apiFetch } from '@/react-app/lib/apiFetch';

const PAGE_SIZE = 24;

export default function BrowseFavoriteClipsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const res = await apiFetch(
      `/api/discover/favorite-artist-feed?events_limit=0&clips_limit=${PAGE_SIZE}&clips_offset=${offset}`,
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error('favorite-artist-feed');
    const data = (await res.json()) as {
      clips?: ClipWithUser[];
      hasMoreClips?: boolean;
      hasFavoriteArtists?: boolean;
    };
    const nextClips = data.clips ?? [];
    if (!data.hasFavoriteArtists) {
      setClips([]);
      setHasMore(false);
      offsetRef.current = 0;
      return;
    }
    if (append) {
      setClips((prev) => [...prev, ...nextClips]);
      offsetRef.current += nextClips.length;
    } else {
      setClips(nextClips);
      offsetRef.current = nextClips.length;
    }
    setHasMore(Boolean(data.hasMoreClips));
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        await fetchPage(0, false);
      } catch {
        setClips([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isPending, navigate, fetchPage]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        await fetchPage(offsetRef.current, true);
      } catch {
        /* ignore */
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  if (isPending || (loading && !user)) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to feed</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">Artists</h1>
          <p className="mt-2 text-gray-400">All clips from artists you follow</p>
        </div>

        <ClipsInfiniteGrid
          clips={clips}
          loading={loading || loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          emptyMessage="Add favorite artists to see their clips here."
        />
      </div>
    </div>
  );
}
