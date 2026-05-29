import type { AdvancedSearchPayload } from '@/react-app/lib/advanced-search';

export type FetchAdvancedSearchOptions = {
  compact?: boolean;
  signal?: AbortSignal;
  location?: string;
  dateRange?: string;
  sortBy?: string;
  genre?: string;
};

export async function fetchAdvancedSearch(
  q: string,
  opts: FetchAdvancedSearchOptions = {},
): Promise<AdvancedSearchPayload> {
  const trimmed = q.trim();
  const params = new URLSearchParams({ q: trimmed });
  if (opts.compact) params.set('compact', '1');
  if (opts.location) params.set('location', opts.location);
  if (opts.dateRange) params.set('dateRange', opts.dateRange);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.genre) params.set('genre', opts.genre);

  const res = await fetch(`/api/search/advanced?${params}`, { signal: opts.signal });
  if (!res.ok) throw new Error('Search failed');
  return (await res.json()) as AdvancedSearchPayload;
}
