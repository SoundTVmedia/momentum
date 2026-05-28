import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdvancedSearchPayload } from '@/react-app/lib/advanced-search';
import {
  peekCachedAdvancedSearch,
  setCachedAdvancedSearch,
} from '@/react-app/lib/advanced-search-cache';

const DEBOUNCE_MS = 360;

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
      const params = new URLSearchParams({ q: trimmed, compact: '1' });
      const res = await fetch(`/api/search/advanced?${params}`, {
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as AdvancedSearchPayload;
      setCachedAdvancedSearch(trimmed, data);
      setResults(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      console.error('Advanced search failed:', err);
      if (!hadStale) setResults(null);
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
      }
      debounceRef.current = setTimeout(() => {
        void runSearch(trimmed);
      }, DEBOUNCE_MS);
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
