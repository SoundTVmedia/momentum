import {
  classifyJamBaseEndpoint,
  coalesceInflight,
  jamBaseCoalesceKey,
  readJamBaseResponseCache,
  recordJamBaseCacheMetric,
  storeJamBaseResponseCache,
} from './jambase-cache';

const JAMBASE_V3_BASE = 'https://api.data.jambase.com/v3';
const JAMBASE_USER_AGENT = 'Feedback/1.0';

/** All-time upstream counter (when `JAMBASE_QUOTA_WINDOW` is unset or `all`). */
const JAMBASE_USAGE_BUCKET_ALLTIME = 'jam:upstream';

export type JamBaseJson = Record<string, unknown> & {
  success?: boolean;
  errors?: unknown[];
  detail?: string;
  title?: string;
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
  /** When set with `bucketId`, upstream calls are capped via `jambase_api_usage`. */
  max?: number;
  /** D1 `jambase_api_usage.bucket_id` used for this cap. */
  bucketId?: string;
};

/**
 * Optional cap on JamBase **upstream** calls (D1 `jambase_api_usage`).
 * **Opt-in only:** set `JAMBASE_QUOTA_ENFORCEMENT=1` (or `true` / `on`) to enable.
 * If unset, no cap is applied.
 * Only increments when the edge **misses** (`cf-cache-status` ≠ `HIT`) — long TTLs reduce burn.
 *
 * Example (6k / month): `JAMBASE_QUOTA_ENFORCEMENT=1` `JAMBASE_QUOTA_MAX=6000` `JAMBASE_QUOTA_WINDOW=month`
 */
export function jamBaseQuotaFromEnv(env: JamBaseQuotaEnv): JamBaseQuotaContext {
  const db = env.DB;
  const raw = env.JAMBASE_QUOTA_ENFORCEMENT?.trim().toLowerCase();
  if (raw !== '1' && raw !== 'true' && raw !== 'on') {
    return { db };
  }
  const max = Number.parseInt(String(env.JAMBASE_QUOTA_MAX ?? '1000'), 10);
  if (!Number.isFinite(max) || max <= 0) {
    return { db };
  }
  const windowRaw = env.JAMBASE_QUOTA_WINDOW?.trim().toLowerCase();
  const useMonth = windowRaw === 'month' || windowRaw === 'monthly';
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const bucketId = useMonth ? `jam:month:${ym}` : JAMBASE_USAGE_BUCKET_ALLTIME;
  return { db, max, bucketId };
}

function jamBaseQuotaEnforced(
  quota: JamBaseQuotaContext | undefined,
): quota is JamBaseQuotaContext & { max: number; bucketId: string } {
  return (
    quota != null &&
    typeof quota.max === 'number' &&
    quota.max > 0 &&
    typeof quota.bucketId === 'string' &&
    quota.bucketId.length > 0
  );
}

export async function jamBaseQuotaPrecheck(quota: JamBaseQuotaContext): Promise<boolean> {
  if (!jamBaseQuotaEnforced(quota)) return true;
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
  if (!jamBaseQuotaEnforced(quota)) return;
  const sql = `INSERT INTO jambase_api_usage (bucket_id, count) VALUES (?, 1)
    ON CONFLICT(bucket_id) DO UPDATE SET count = count + 1, updated_at = datetime('now')`;
  try {
    await quota.db.prepare(sql).bind(quota.bucketId).run();
  } catch (e) {
    console.error('[JamBase] Quota increment failed', e);
  }
}

const JAMBASE_429_MAX_ATTEMPTS = 3;
/** Per-request ceiling so home-feed nearby lookups do not hang ~30s+ on slow upstream. */
const JAMBASE_FETCH_TIMEOUT_MS = 12_000;
/** Total wall time for one logical `jamBaseFetch` (includes 429 backoff). */
const JAMBASE_FETCH_BUDGET_MS = 18_000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse JamBase / CDN `Retry-After` (seconds or HTTP-date). Caps wait to keep Workers responsive. */
function retryAfterDelayMs(header: string | null, attemptIndex: number): number {
  const fallbackSec = Math.min(8, 1 + attemptIndex * 2);
  if (!header?.trim()) return Math.min(10_000, fallbackSec * 1000);
  const sec = Number.parseInt(header.trim(), 10);
  if (Number.isFinite(sec) && sec > 0) {
    return Math.min(10_000, sec * 1000);
  }
  const when = Date.parse(header.trim());
  if (Number.isFinite(when)) {
    return Math.min(10_000, Math.max(0, when - Date.now()));
  }
  return Math.min(10_000, fallbackSec * 1000);
}

/** Optional: caller mutates this when `jamBaseFetch` returns null (not set on inflight dedupe hits). */
export type JamBaseFetchDiag = {
  failure?:
    | 'missing_key'
    | 'quota'
    | 'http'
    | 'non_json'
    | 'api_error'
    | 'network'
    | 'timeout'
    | 'unknown';
  httpStatus?: number;
  /** JamBase RFC7807 `detail` or first error message when present. */
  httpDetail?: string;
};

export type JamBaseFetchOptions = {
  /** Skip Cloudflare subrequest cache (use for health probes after key rotation). */
  bypassEdgeCache?: boolean;
  /** Skip D1 response cache (probes / forced refresh). */
  skipResponseCache?: boolean;
  /** Override per-call wall budget (default {@link JAMBASE_FETCH_BUDGET_MS}). */
  fetchBudgetMs?: number;
  /** Override per-fetch timeout (default {@link JAMBASE_FETCH_TIMEOUT_MS}). */
  fetchTimeoutMs?: number;
};

/** Strip quotes / accidental `Bearer ` prefix from dashboard or .dev.vars pastes. */
export function normalizeJamBaseApiKey(apiKey: string | undefined): string {
  let k = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!k) return '';
  if (k.toLowerCase().startsWith('bearer ')) {
    k = k.slice(7).trim();
  }
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

function jamBaseProblemDetail(json: JamBaseJson, text: string): string | undefined {
  const detail = json.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  const title = json.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  const errors = json.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (typeof first === 'object' && first !== null) {
      const msg = (first as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    }
  }
  if (text.length > 0 && text.length < 240) return text;
  return undefined;
}

/**
 * JamBase Data API v3 fetch with:
 * - D1 response cache (permanent IDs / geo; 72h event lists; past events never expire)
 * - In-flight coalescing so concurrent callers share one upstream request
 * - No CF subrequest cache (auth header is not part of URL cache keys — caused stale errors)
 * - Optional D1-backed global cap on upstream calls
 */
export async function jamBaseFetch<T extends JamBaseJson>(
  apiKey: string | undefined,
  path: string,
  params: Record<string, string | undefined> = {},
  quota?: JamBaseQuotaContext | undefined,
  diag?: JamBaseFetchDiag,
  options?: JamBaseFetchOptions,
): Promise<T | null> {
  const key = normalizeJamBaseApiKey(apiKey);
  if (!key) {
    if (diag) diag.failure = 'missing_key';
    return null;
  }

  const db = quota?.db;
  const endpoint = classifyJamBaseEndpoint(path, params);
  const skipResponseCache =
    options?.skipResponseCache === true || options?.bypassEdgeCache === true;

  if (db && !skipResponseCache) {
    const cached = await readJamBaseResponseCache(db, path, params);
    if (cached) {
      await recordJamBaseCacheMetric(db, endpoint, 'hit');
      return cached as T;
    }
  }

  const url = new URL(`${JAMBASE_V3_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  const coalesceKey = jamBaseCoalesceKey(path, params);
  const bypassEdgeCache = options?.bypassEdgeCache === true;
  const fetchBudgetMs = options?.fetchBudgetMs ?? JAMBASE_FETCH_BUDGET_MS;
  const fetchTimeoutMs = options?.fetchTimeoutMs ?? JAMBASE_FETCH_TIMEOUT_MS;

  return coalesceInflight(coalesceKey, async (): Promise<T | null> => {
    if (db && !skipResponseCache) {
      const cached = await readJamBaseResponseCache(db, path, params);
      if (cached) {
        await recordJamBaseCacheMetric(db, endpoint, 'hit');
        return cached as T;
      }
    }

    const startedAt = Date.now();
    try {
      let res: Response;
      let attempt = 0;
      while (true) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= fetchBudgetMs) {
          console.warn('[JamBase] fetch budget exceeded', path, { elapsedMs: elapsed });
          if (diag) diag.failure = 'timeout';
          return null;
        }

        if (quota && !(await jamBaseQuotaPrecheck(quota))) {
          if (diag) diag.failure = 'quota';
          return null;
        }
        try {
          const remaining = fetchBudgetMs - elapsed;
          const fetchInit: RequestInit = {
            headers: {
              Authorization: `Bearer ${key}`,
              Accept: 'application/json',
              'User-Agent': JAMBASE_USER_AGENT,
            },
            signal: AbortSignal.timeout(Math.min(fetchTimeoutMs, remaining)),
          };
          // Do NOT use cacheEverything: JamBase auth is in Authorization, but CF subrequest
          // cache keys are URL-only — stale 401/400 responses survive key rotation.
          if (!bypassEdgeCache) {
            (fetchInit as RequestInit & { cf?: unknown }).cf = {
              cacheTtl: 0,
              cacheEverything: false,
            };
          } else {
            (fetchInit as RequestInit & { cf?: unknown }).cf = { cacheTtl: 0 };
          }
          res = await fetch(url.toString(), fetchInit);
        } catch (e) {
          const timedOut =
            e instanceof Error &&
            (e.name === 'TimeoutError' || e.name === 'AbortError' || /aborted|timeout/i.test(e.message));
          console.error('JamBase fetch network error', path, e);
          if (diag) diag.failure = timedOut ? 'timeout' : 'network';
          return null;
        }

        if (res.status === 429 && attempt < JAMBASE_429_MAX_ATTEMPTS - 1) {
          const budgetLeft = JAMBASE_FETCH_BUDGET_MS - (Date.now() - startedAt);
          const waitMs = Math.min(
            retryAfterDelayMs(res.headers.get('Retry-After'), attempt),
            Math.max(0, budgetLeft - 500),
          );
          if (waitMs <= 0) {
            if (diag) diag.failure = 'timeout';
            return null;
          }
          console.warn('JamBase HTTP 429, backing off (ms)', path, waitMs, { attempt });
          await res.text().catch(() => {});
          await sleepMs(waitMs);
          attempt += 1;
          continue;
        }
        break;
      }

      if (quota && jamBaseResponseCountsAsUpstream(res)) {
        await jamBaseRecordUpstream(quota);
      }

      const text = await res.text();
      let json: T;
      try {
        json = JSON.parse(text) as T;
      } catch {
        console.error('JamBase non-JSON', path, res.status, text.slice(0, 200));
        if (diag) {
          diag.failure = 'non_json';
          diag.httpStatus = res.status;
        }
        return null;
      }

      const problemDetail = jamBaseProblemDetail(json, text);

      if (!res.ok) {
        const errBody = json as { errors?: unknown; success?: unknown };
        console.error('JamBase HTTP error', path, res.status, text.slice(0, 800), {
          errors: errBody.errors ?? null,
          success: errBody.success,
        });
        if (diag) {
          diag.failure = 'http';
          diag.httpStatus = res.status;
          if (problemDetail) diag.httpDetail = problemDetail;
        }
        return null;
      }

      if (json.success === false) {
        console.error('JamBase API error', path, json.errors);
        if (diag) {
          diag.failure = 'api_error';
          if (problemDetail) diag.httpDetail = problemDetail;
        }
        return null;
      }

      if (db && !skipResponseCache) {
        await recordJamBaseCacheMetric(db, endpoint, 'upstream');
        await storeJamBaseResponseCache(db, path, params, json);
      }

      return json;
    } catch (e) {
      console.error('JamBase fetch unexpected error', path, e);
      if (diag) diag.failure = 'unknown';
      return null;
    }
  });
}

export function jamBaseEventDateFromToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function jamBaseApiKeyConfigured(apiKey: string | undefined): boolean {
  return normalizeJamBaseApiKey(apiKey).length > 0;
}

/** User-facing notice when the worker has no JamBase token loaded. */
export function jamBaseMissingKeyNotice(): string {
  return 'JamBase is not configured. Set JAMBASE_API_KEY in .dev.vars (local) or run `wrangler secret put JAMBASE_API_KEY` (production), then restart the worker.';
}

/** Map upstream `jamBaseFetch` failures to a user-visible notice (empty results, no failure → null). */
export function jamBaseUpstreamFailureNotice(
  apiKey: string | undefined,
  diag?: JamBaseFetchDiag,
): string | null {
  if (!jamBaseApiKeyConfigured(apiKey)) {
    return jamBaseMissingKeyNotice();
  }
  if (!diag?.failure) {
    return null;
  }
  switch (diag.failure) {
    case 'timeout':
      return 'JamBase timed out loading shows. Try again — if this persists, check JAMBASE_API_KEY and worker logs.';
    case 'quota':
      return 'JamBase call quota reached (JAMBASE_QUOTA_ENFORCEMENT). Shows are paused until the budget resets.';
    case 'http': {
      const status = diag.httpStatus != null ? ` (HTTP ${diag.httpStatus})` : '';
      const detail = diag.httpDetail ? ` — ${diag.httpDetail}` : '';
      if (diag.httpStatus === 401 || diag.httpStatus === 403) {
        return `JamBase rejected the API key${status}${detail}. Regenerate at data.jambase.com and update JAMBASE_API_KEY (raw token only, no "Bearer").`;
      }
      if (diag.httpStatus === 429) {
        return `JamBase rate limit${status}${detail}. Wait a few minutes or check your plan limits at data.jambase.com.`;
      }
      return `JamBase returned an HTTP error${status}${detail}. Check worker logs and JAMBASE_API_KEY.`;
    }
    case 'api_error':
      return diag.httpDetail
        ? `JamBase API error — ${diag.httpDetail}`
        : 'JamBase returned success: false. Check worker logs for errors[].';
    case 'missing_key':
      return jamBaseMissingKeyNotice();
    case 'network':
      return 'Could not reach JamBase (network error). Try again shortly.';
    default:
      return 'JamBase did not return shows (upstream error). Check JAMBASE_API_KEY and worker logs.';
  }
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
