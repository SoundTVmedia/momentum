import type { YoutubeVideoDto } from './youtube-client';

const YT_USAGE_BUCKET_DAY_PREFIX = 'yt:day:';

/** Env slice for optional YouTube daily quota (D1 `youtube_api_usage`). */
export interface YoutubeQuotaEnv {
  DB: D1Database;
  YOUTUBE_QUOTA_ENFORCEMENT?: string;
  /** Max YouTube API **units** per UTC day when enforcement is on. Default 9500 (under 10k default). */
  YOUTUBE_QUOTA_MAX?: string;
}

export type YoutubeQuotaContext = {
  db: D1Database;
  max: number;
  bucketId: string;
};

export function youtubeQuotaFromEnv(env: YoutubeQuotaEnv): YoutubeQuotaContext | undefined {
  const raw = env.YOUTUBE_QUOTA_ENFORCEMENT?.trim().toLowerCase();
  if (raw !== '1' && raw !== 'true' && raw !== 'on') {
    return undefined;
  }
  const max = Number.parseInt(String(env.YOUTUBE_QUOTA_MAX ?? '9500'), 10);
  if (!Number.isFinite(max) || max <= 0) {
    return undefined;
  }
  const now = new Date();
  const day = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  return { db: env.DB, max, bucketId: `${YT_USAGE_BUCKET_DAY_PREFIX}${day}` };
}

export async function youtubeQuotaPrecheck(
  quota: YoutubeQuotaContext,
  units: number,
): Promise<boolean> {
  try {
    const row = await quota.db
      .prepare('SELECT count FROM youtube_api_usage WHERE bucket_id = ?')
      .bind(quota.bucketId)
      .first<{ count: number }>();
    const n = row?.count ?? 0;
    if (n + units > quota.max) {
      console.warn('[YouTube] Quota would exceed daily cap', {
        bucket: quota.bucketId,
        count: n,
        units,
        max: quota.max,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[YouTube] Quota read failed (apply migration 50.sql?)', e);
    return true;
  }
}

export async function youtubeRecordUpstream(
  quota: YoutubeQuotaContext,
  units: number,
): Promise<void> {
  const sql = `INSERT INTO youtube_api_usage (bucket_id, count) VALUES (?, ?)
    ON CONFLICT(bucket_id) DO UPDATE SET
      count = count + excluded.count,
      updated_at = datetime('now')`;
  try {
    await quota.db.prepare(sql).bind(quota.bucketId, units).run();
  } catch (e) {
    console.error('[YouTube] Quota increment failed', e);
  }
}

/** YouTube Data API v3 quota units per HTTP call (approximate). */
export function youtubeRequestUnits(path: string, _params?: Record<string, string>): number {
  if (path === '/search') return 100;
  return 1;
}

export function normalizeYoutubeArtistCacheKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function youtubeChannelResolveCacheKey(artistName: string): string {
  return `yt:channel:${normalizeYoutubeArtistCacheKey(artistName)}`;
}

export function youtubeVideoPoolCacheKey(channelId: string): string {
  return `yt:pool:ch:${channelId.trim()}`;
}

export function youtubeVideoPoolSearchCacheKey(artistName: string): string {
  return `yt:pool:search:${normalizeYoutubeArtistCacheKey(artistName)}`;
}

export function youtubeFavoriteFeedCacheKey(uid: string, limit: number): string {
  return `yt:fav:${uid}:l${limit}`;
}

type CacheRow = { payload: string; expires_at: string };

export async function getYoutubeCachedPayload<T>(
  db: D1Database,
  cacheKey: string,
  opts?: { allowStaleDays?: number },
): Promise<T | null> {
  try {
    const fresh = (await db
      .prepare(
        `SELECT payload FROM youtube_response_cache
         WHERE cache_key = ? AND expires_at > datetime('now')`,
      )
      .bind(cacheKey)
      .first()) as { payload: string } | null;
    if (fresh?.payload) {
      return JSON.parse(fresh.payload) as T;
    }

    const staleDays = opts?.allowStaleDays ?? 0;
    if (staleDays <= 0) return null;

    const row = (await db
      .prepare('SELECT payload, expires_at FROM youtube_response_cache WHERE cache_key = ?')
      .bind(cacheKey)
      .first()) as CacheRow | null;
    if (!row?.payload) return null;

    const staleRow = (await db
      .prepare(
        `SELECT 1 AS ok WHERE datetime(?, '+' || ? || ' days') > datetime('now')`,
      )
      .bind(row.expires_at, String(staleDays))
      .first()) as { ok: number } | null;

    if (staleRow?.ok) {
      return JSON.parse(row.payload) as T;
    }
    return null;
  } catch (e) {
    console.error('[YouTube] Cache read failed', cacheKey, e);
    return null;
  }
}

export async function setYoutubeCachedPayload(
  db: D1Database,
  cacheKey: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString().slice(0, 19);
  try {
    await db
      .prepare(
        `INSERT INTO youtube_response_cache (cache_key, payload, expires_at, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(cache_key) DO UPDATE SET
           payload = excluded.payload,
           expires_at = excluded.expires_at,
           updated_at = datetime('now')`,
      )
      .bind(cacheKey, JSON.stringify(payload), expiresAt)
      .run();
  } catch (e) {
    console.error('[YouTube] Cache write failed', cacheKey, e);
  }
}

export async function getCachedArtistVideoPool(
  db: D1Database,
  channelId: string | null,
  artistName: string,
  allowStaleOnQuota = true,
): Promise<YoutubeVideoDto[] | null> {
  const staleDays = allowStaleOnQuota ? 7 : 0;
  if (channelId) {
    const hit = await getYoutubeCachedPayload<YoutubeVideoDto[]>(
      db,
      youtubeVideoPoolCacheKey(channelId),
      { allowStaleDays: staleDays },
    );
    if (hit) return hit;
  }
  return getYoutubeCachedPayload<YoutubeVideoDto[]>(
    db,
    youtubeVideoPoolSearchCacheKey(artistName),
    { allowStaleDays: staleDays },
  );
}

export async function setCachedArtistVideoPool(
  db: D1Database,
  channelId: string | null,
  artistName: string,
  videos: YoutubeVideoDto[],
): Promise<void> {
  const ttl = 6 * 3600; // 6h fresh pool
  if (channelId) {
    await setYoutubeCachedPayload(db, youtubeVideoPoolCacheKey(channelId), videos, ttl);
  }
  await setYoutubeCachedPayload(db, youtubeVideoPoolSearchCacheKey(artistName), videos, ttl);
}

export function isYoutubeQuotaExceededError(message: string): boolean {
  return /quota|dailyLimit|rateLimit|exceeded/i.test(message);
}
