const JAMBASE_V3_BASE = 'https://api.data.jambase.com/v3';
const JAMBASE_USER_AGENT = 'Feedback/1.0';

/** All-time upstream counter (when `JAMBASE_QUOTA_WINDOW` is unset or `all`). */
const JAMBASE_USAGE_BUCKET_ALLTIME = 'jam:upstream';

/**
 * Edge cache TTLs (seconds). `cacheEverything` + identical URLs share hits across users and isolates.
 * Tune for fewer upstream calls vs fresher listings (important for monthly API caps).
 */
const TTL_GEOGRAPHIES_SEC = 604_800; // 7d — city/metro lookups rarely change
const TTL_GENRES_SEC = 604_800; // 7d
const TTL_ENTITY_BY_ID_SEC = 21_600; // 6h — GET /v3/artists/{id}, /v3/venues/{id}
const TTL_ARTISTS_SEARCH_SEC = 7_200; // 2h — name search lists
const TTL_VENUES_SEARCH_SEC = 3_600; // 1h — geo / city venue lists
const TTL_EVENTS_SEARCH_SEC = 2_400; // 40m — event grids (same URL = shared cache)
const TTL_DEFAULT_SEC = 1_800; // 30m

export type JamBaseJson = Record<string, unknown> & {
  success?: boolean;
  errors?: unknown[];
};

/** Env slice used to build optional global JamBase quota (D1-backed). */
export interface JamBaseQuotaEnv {
  DB: D1Database;
  JAMBASE_QUOTA_ENFORCEMENT?: string;
  /** Max upstream JamBase calls per window (non–edge-cache `cf-cache-status` hits only). Default 1000. */
  JAMBASE_QUOTA_MAX?: string;
  /**
   * When enforcement is on: `all` (default) = one D1 row `jam:upstream` forever;
   * `month` = separate row per UTC month `jam:month:YYYY-MM` (resets automatically each month).
   */
  JAMBASE_QUOTA_WINDOW?: string;
}

export type JamBaseQuotaContext = {
  db: D1Database;
  max: number;
  /** D1 `jambase_api_usage.bucket_id` used for this cap. */
  bucketId: string;
};

/**
 * Optional cap on JamBase **upstream** calls (D1 `jambase_api_usage`).
 * **Opt-in only:** set `JAMBASE_QUOTA_ENFORCEMENT=1` (or `true` / `on`) to enable.
 * If unset, no cap is applied.
 * Only increments when the edge **misses** (`cf-cache-status` ≠ `HIT`) — long TTLs reduce burn.
 *
 * Example (6k / month): `JAMBASE_QUOTA_ENFORCEMENT=1` `JAMBASE_QUOTA_MAX=6000` `JAMBASE_QUOTA_WINDOW=month`
 */
export function jamBaseQuotaFromEnv(env: JamBaseQuotaEnv): JamBaseQuotaContext | undefined {
  const raw = env.JAMBASE_QUOTA_ENFORCEMENT?.trim().toLowerCase();
  if (raw !== '1' && raw !== 'true' && raw !== 'on') {
    return undefined;
  }
  const max = Number.parseInt(String(env.JAMBASE_QUOTA_MAX ?? '1000'), 10);
  if (!Number.isFinite(max) || max <= 0) {
    return undefined;
  }
  const windowRaw = env.JAMBASE_QUOTA_WINDOW?.trim().toLowerCase();
  const useMonth = windowRaw === 'month' || windowRaw === 'monthly';
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const bucketId = useMonth ? `jam:month:${ym}` : JAMBASE_USAGE_BUCKET_ALLTIME;
  return { db: env.DB, max, bucketId };
}

async function jamBaseQuotaPrecheck(quota: JamBaseQuotaContext): Promise<boolean> {
  try {
    const row = await quota.db
      .prepare('SELECT count FROM jambase_api_usage WHERE bucket_id = ?')
      .bind(quota.bucketId)
      .first<{ count: number }>();
    const n = row?.count ?? 0;
    if (n >= quota.max) {
      console.warn('[JamBase] Quota exceeded', {
        bucket: quota.bucketId,
        count: n,
        max: quota.max,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[JamBase] Quota read failed (apply migration 42.sql?)', e);
    return true;
  }
}

function jamBaseResponseCountsAsUpstream(res: Response): boolean {
  const s = res.headers.get('cf-cache-status')?.toUpperCase() ?? '';
  return s !== 'HIT';
}

async function jamBaseRecordUpstream(quota: JamBaseQuotaContext): Promise<void> {
  const sql = `INSERT INTO jambase_api_usage (bucket_id, count) VALUES (?, 1)
    ON CONFLICT(bucket_id) DO UPDATE SET count = count + 1, updated_at = datetime('now')`;
  try {
    await quota.db.prepare(sql).bind(quota.bucketId).run();
  } catch (e) {
    console.error('[JamBase] Quota increment failed', e);
  }
}

/** Cloudflare edge cache TTL for identical JamBase URLs (reduces upstream / quota use). */
function jamBaseCacheTtlSeconds(url: URL): number {
  const p = url.pathname;
  if (p.includes('/geographies')) return TTL_GEOGRAPHIES_SEC;
  if (p.includes('/genres')) return TTL_GENRES_SEC;
  // Single-entity by ID: longer cache (detail pages, tour lookups).
  if (/^\/v3\/artists\/[^/]+$/.test(p)) return TTL_ENTITY_BY_ID_SEC;
  if (/^\/v3\/venues\/[^/]+$/.test(p)) return TTL_ENTITY_BY_ID_SEC;
  if (p.includes('/artists')) return TTL_ARTISTS_SEARCH_SEC;
  if (p.includes('/venues')) return TTL_VENUES_SEARCH_SEC;
  if (p.includes('/events')) return TTL_EVENTS_SEARCH_SEC;
  return TTL_DEFAULT_SEC;
}

const inflight = new Map<string, Promise<JamBaseJson | null>>();

/**
 * JamBase Data API v3 fetch with:
 * - Edge cache (cf.cacheEverything) so repeat queries often skip JamBase
 * - In-flight deduplication for concurrent identical requests in the same isolate
 * - Optional D1-backed global cap on upstream calls (non-cache hits only)
 */
export async function jamBaseFetch<T extends JamBaseJson>(
  apiKey: string | undefined,
  path: string,
  params: Record<string, string | undefined> = {},
  quota?: JamBaseQuotaContext | undefined
): Promise<T | null> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return null;

  const url = new URL(`${JAMBASE_V3_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  const urlKey = url.toString();
  const existing = inflight.get(urlKey) as Promise<T | null> | undefined;
  if (existing) return existing;

  const cacheTtl = jamBaseCacheTtlSeconds(url);

  const promise = (async (): Promise<T | null> => {
    try {
      if (quota && !(await jamBaseQuotaPrecheck(quota))) {
        return null;
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'User-Agent': JAMBASE_USER_AGENT,
        },
        cf: {
          cacheEverything: true,
          cacheTtl,
          cacheTtlByStatus: {
            '200-299': cacheTtl,
            '400-499': 120,
            '429': 0,
            '500-599': 0,
          },
        },
      } as RequestInit);

      if (quota && jamBaseResponseCountsAsUpstream(res)) {
        await jamBaseRecordUpstream(quota);
      }

      const text = await res.text();
      let json: T;
      try {
        json = JSON.parse(text) as T;
      } catch {
        console.error('JamBase non-JSON', path, res.status, text.slice(0, 200));
        return null;
      }

      if (!res.ok) {
        console.error('JamBase HTTP error', path, res.status, text.slice(0, 200));
        return null;
      }

      if (json.success === false) {
        console.error('JamBase API error', path, json.errors);
        return null;
      }

      return json;
    } finally {
      inflight.delete(urlKey);
    }
  })();

  inflight.set(urlKey, promise as Promise<JamBaseJson | null>);
  return promise;
}

export function jamBaseEventDateFromToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Housekeeping for `jambase_api_usage`.
 * - Removes legacy `jam:h:*` buckets from older quota experiments.
 * - Drops `jam:month:YYYY-MM` rows older than ~15 months (string compare on ISO months is safe).
 * Does **not** delete `jam:upstream` or the current month’s `jam:month:*` row.
 */
export async function pruneJamBaseApiUsageBuckets(db: D1Database): Promise<void> {
  try {
    await db.prepare(`DELETE FROM jambase_api_usage WHERE bucket_id LIKE 'jam:h:%'`).run();

    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 15);
    const y = cutoff.getUTCFullYear();
    const m = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
    const cutoffBucket = `jam:month:${y}-${m}`;
    await db
      .prepare(
        `DELETE FROM jambase_api_usage WHERE bucket_id LIKE 'jam:month:%' AND bucket_id < ?`
      )
      .bind(cutoffBucket)
      .run();
  } catch (e) {
    console.error('[JamBase] pruneJamBaseApiUsageBuckets failed', e);
  }
}
