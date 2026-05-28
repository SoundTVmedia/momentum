import type { AdvancedSearchPayload } from '@/react-app/lib/advanced-search';

const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { at: number; data: AdvancedSearchPayload }>();

function cacheKey(q: string): string {
  return q.trim().toLowerCase();
}

/** Cached payload if present (may be past TTL — use for stale-while-revalidate). */
export function peekCachedAdvancedSearch(q: string): AdvancedSearchPayload | null {
  const hit = cache.get(cacheKey(q));
  return hit?.data ?? null;
}

export function isCachedAdvancedSearchFresh(q: string): boolean {
  const hit = cache.get(cacheKey(q));
  if (!hit) return false;
  return Date.now() - hit.at <= CACHE_TTL_MS;
}

/** Fresh cache only (legacy callers). */
export function getCachedAdvancedSearch(q: string): AdvancedSearchPayload | null {
  if (!isCachedAdvancedSearchFresh(q)) {
    cache.delete(cacheKey(q));
    return null;
  }
  return peekCachedAdvancedSearch(q);
}

export function setCachedAdvancedSearch(q: string, data: AdvancedSearchPayload): void {
  const key = cacheKey(q);
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 40) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) cache.delete(oldest);
  }
}
