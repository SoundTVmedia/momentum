const JAMBASE_V3_BASE = 'https://api.data.jambase.com/v3';
const JAMBASE_USER_AGENT = 'Feedback/1.0';

/** Single D1 row for counting all-time upstream JamBase usage in this deployment. */
const JAMBASE_USAGE_BUCKET_ID = 'jam:upstream';

export type JamBaseJson = Record<string, unknown> & {
  success?: boolean;
  errors?: unknown[];
};

/** Env slice used to build optional global JamBase quota (D1-backed). */
export interface JamBaseQuotaEnv {
  DB: D1Database;
  JAMBASE_QUOTA_ENFORCEMENT?: string;
  /** Max upstream JamBase calls (non–edge-cache). Default 1000; raise when your plan allows. */
  JAMBASE_QUOTA_MAX?: string;
}

export type JamBaseQuotaContext = {
  db: D1Database;
  max: number;
};

/**
 * Global quota for JamBase trial / paid caps. Default: **1000** upstream calls total (one D1 counter).
 * Set `JAMBASE_QUOTA_ENFORCEMENT=0` to disable (e.g. local dev without migration 42).
 * Only counts responses that were not served from Cloudflare edge cache (`cf-cache-status: HIT`).
 */
export function jamBaseQuotaFromEnv(env: JamBaseQuotaEnv): JamBaseQuotaContext | undefined {
  const raw = env.JAMBASE_QUOTA_ENFORCEMENT?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return undefined;
  }
  const max = Number.parseInt(String(env.JAMBASE_QUOTA_MAX ?? '1000'), 10);
  if (!Number.isFinite(max) || max <= 0) {
    return undefined;
  }
  return { db: env.DB, max };
}

async function jamBaseQuotaPrecheck(quota: JamBaseQuotaContext): Promise<boolean> {
  try {
    const row = await quota.db
      .prepare('SELECT count FROM jambase_api_usage WHERE bucket_id = ?')
      .bind(JAMBASE_USAGE_BUCKET_ID)
      .first<{ count: number }>();
    const n = row?.count ?? 0;
    if (n >= quota.max) {
      console.warn('[JamBase] Global quota exceeded', {
        bucket: JAMBASE_USAGE_BUCKET_ID,
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
    await quota.db.prepare(sql).bind(JAMBASE_USAGE_BUCKET_ID).run();
  } catch (e) {
    console.error('[JamBase] Quota increment failed', e);
  }
}

/** Cloudflare edge cache TTL for identical JamBase URLs (reduces quota use across users). */
function jamBaseCacheTtlSeconds(url: URL): number {
  const p = url.pathname;
  if (p.includes('/geographies')) return 86_400;
  if (p.endsWith('/genres')) return 604_800;
  if (p.includes('/artists') || p.includes('/venues')) return 3600;
  if (p.includes('/events')) return 900;
  return 600;
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

/** Remove legacy per-hour / per-month rows if any; single-bucket mode uses `jam:upstream` only. */
export async function pruneJamBaseApiUsageBuckets(db: D1Database): Promise<void> {
  try {
    await db
      .prepare(
        `DELETE FROM jambase_api_usage WHERE bucket_id LIKE 'jam:h:%' OR bucket_id LIKE 'jam:m:%'`
      )
      .run();
  } catch (e) {
    console.error('[JamBase] pruneJamBaseApiUsageBuckets failed', e);
  }
}
