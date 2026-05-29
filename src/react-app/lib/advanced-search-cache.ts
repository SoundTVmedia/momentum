import type { AdvancedSearchPayload } from '@/react-app/lib/advanced-search';

const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { at: number; data: AdvancedSearchPayload }>();

export type AdvancedSearchCacheOpts = {
  radiusMiles?: number;
  compact?: boolean;
  location?: string;
  dateRange?: string;
  sortBy?: string;
  genre?: string;
};

function cacheKey(q: string, opts?: AdvancedSearchCacheOpts): string {
  const parts = [q.trim().toLowerCase()];
  if (opts?.radiusMiles != null) parts.push(`r${opts.radiusMiles}`);
  if (opts?.compact) parts.push('compact');
  if (opts?.location?.trim()) parts.push(`loc:${opts.location.trim().toLowerCase()}`);
  if (opts?.dateRange?.trim()) parts.push(`dr:${opts.dateRange.trim()}`);
  if (opts?.sortBy?.trim()) parts.push(`sb:${opts.sortBy.trim()}`);
  if (opts?.genre?.trim()) parts.push(`g:${opts.genre.trim()}`);
  return parts.join('|');
}

/** Cached payload if present (may be past TTL — use for stale-while-revalidate). */
export function peekCachedAdvancedSearch(
  q: string,
  opts?: AdvancedSearchCacheOpts,
): AdvancedSearchPayload | null {
  const hit = cache.get(cacheKey(q, opts));
  return hit?.data ?? null;
}

export function isCachedAdvancedSearchFresh(q: string, opts?: AdvancedSearchCacheOpts): boolean {
  const hit = cache.get(cacheKey(q, opts));
  if (!hit) return false;
  return Date.now() - hit.at <= CACHE_TTL_MS;
}

/** Fresh cache only (legacy callers). */
export function getCachedAdvancedSearch(
  q: string,
  opts?: AdvancedSearchCacheOpts,
): AdvancedSearchPayload | null {
  if (!isCachedAdvancedSearchFresh(q, opts)) {
    cache.delete(cacheKey(q, opts));
    return null;
  }
  return peekCachedAdvancedSearch(q, opts);
}

export function setCachedAdvancedSearch(
  q: string,
  data: AdvancedSearchPayload,
  opts?: AdvancedSearchCacheOpts,
): void {
  const key = cacheKey(q, opts);
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 60) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) cache.delete(oldest);
  }
}
