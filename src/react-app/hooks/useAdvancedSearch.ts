import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdvancedSearchPayload } from '@/react-app/lib/advanced-search';

const DEBOUNCE_MS = 280;

export function useAdvancedSearch() {
  const [results, setResults] = useState<AdvancedSearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: trimmed, compact: '1' });
      const res = await fetch(`/api/search/advanced?${params}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as AdvancedSearchPayload;
      setResults(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Advanced search failed:', err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults(null);
        setLoading(false);
        return;
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

  return { results, loading, scheduleSearch, cancelSearch, reset };
}
