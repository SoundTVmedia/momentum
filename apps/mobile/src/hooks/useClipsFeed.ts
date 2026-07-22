import { useCallback, useEffect, useState } from 'react';
import { fetchClipsPage } from '@/src/lib/api/clips';
import type { ClipFeedItem } from '@/src/lib/api/types';

export function useClipsFeed(sortBy: 'latest' | 'most_liked' | 'most_viewed' = 'latest') {
  const [clips, setClips] = useState<ClipFeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, mode: 'replace' | 'append') => {
      const result = await fetchClipsPage({ page: nextPage, limit: 12, sortBy });
      setPage(result.page);
      setHasMore(result.hasMore);
      setClips((prev) =>
        mode === 'replace' ? result.clips : [...prev, ...result.clips],
      );
    },
    [sortBy],
  );

  const reload = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      await loadPage(1, 'replace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clips');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [loadPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPage(1, 'replace');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load clips');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, 'append');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, loadPage, page]);

  return {
    clips,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    reload,
    loadMore,
  };
}
