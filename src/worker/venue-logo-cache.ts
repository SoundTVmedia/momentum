export type VenueLogoCacheSource = 'jambase' | 'website' | 'none';

export function jamBaseLogoCacheKey(jambaseId: string): string {
  return `jb:${jambaseId.trim()}`;
}

export function websiteLogoCacheKey(websiteUrl: string): string {
  try {
    const host = new URL(websiteUrl).hostname.toLowerCase();
    return `web:${host}`;
  } catch {
    return `web:${websiteUrl.trim().toLowerCase()}`;
  }
}

/** `undefined` = not cached; `null` = cached miss (do not retry). */
export async function getVenueLogoFromCache(
  db: D1Database,
  cacheKeys: string[],
): Promise<string | null | undefined> {
  for (const key of cacheKeys) {
    const row = await db
      .prepare(`SELECT logo_url FROM venue_logo_cache WHERE cache_key = ?`)
      .bind(key)
      .first<{ logo_url: string | null }>();
    if (row) return row.logo_url ?? null;
  }
  return undefined;
}

export async function persistVenueLogoCache(
  db: D1Database,
  entries: Array<{
    cacheKey: string;
    jambaseId?: string | null;
    websiteUrl?: string | null;
    logoUrl: string | null;
    source: VenueLogoCacheSource;
  }>,
): Promise<void> {
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT INTO venue_logo_cache (cache_key, jambase_id, website_url, logo_url, source)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO NOTHING`,
      )
      .bind(
        entry.cacheKey,
        entry.jambaseId ?? null,
        entry.websiteUrl ?? null,
        entry.logoUrl,
        entry.source,
      )
      .run();
  }
}
