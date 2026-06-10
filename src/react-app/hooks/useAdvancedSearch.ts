import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdvancedSearchPayload } from '@/react-app/lib/advanced-search';
import { fetchAdvancedSearch } from '@/react-app/lib/fetch-advanced-search';
import {
  peekCachedAdvancedSearch,
  setCachedAdvancedSearch,
} from '@/react-app/lib/advanced-search-cache';

/** Wait after typing stops before hitting the network (cache miss). */
const DEBOUNCE_MS = 160;
/** Shorter wait when showing cached results while revalidating. */
const DEBOUNCE_REVALIDATE_MS = 220;

export function useAdvancedSearch() {
  const [results, setResults] = useState<AdvancedSearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      setRevalidating(false);
      return;
    }

    const stale = peekCachedAdvancedSearch(trimmed);
    const hadStale = stale != null;
    if (stale) {
      setResults(stale);
      setLoading(false);
      setRevalidating(true);
    } else {
      setLoading(true);
      setRevalidating(false);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    try {
      const data = await fetchAdvancedSearch(trimmed, {
        compact: true,
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current) return;
      setCachedAdvancedSearch(trimmed, data);
      setResults(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      console.error('Advanced search failed:', err);
      if (!hadStale) {
        const timedOut =
          err instanceof Error &&
          (err.name === 'TimeoutError' || err.name === 'AbortError');
        setResults({
          clips: [],
          artists: [],
          venues: [],
          users: [],
          jambase: { artists: [], venues: [], events: [] },
          jambaseNotice: timedOut
            ? 'Search timed out — JamBase may be slow or misconfigured on the worker. Try again or check JAMBASE_API_KEY.'
            : 'Search could not complete. Try again.',
        });
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRevalidating(false);
      }
    }
  }, []);

  const scheduleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults(null);
        setLoading(false);
        setRevalidating(false);
        return;
      }
      const stale = peekCachedAdvancedSearch(trimmed);
      if (stale) {
        setResults(stale);
        setLoading(false);
        setRevalidating(true);
      } else {
        setLoading(true);
        setRevalidating(false);
      }
      const delay = stale ? DEBOUNCE_REVALIDATE_MS : DEBOUNCE_MS;
      debounceRef.current = setTimeout(() => {
        void runSearch(trimmed);
      }, delay);
    },
    [runSearch],
  );

  const cancelSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    setResults(null);
    setLoading(false);
    setRevalidating(false);
  }, []);

  const reset = useCallback(() => {
    cancelSearch();
    setResults(null);
  }, [cancelSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { results, loading, revalidating, scheduleSearch, cancelSearch, reset };
}
