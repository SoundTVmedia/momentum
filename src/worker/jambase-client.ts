const JAMBASE_V3_BASE = 'https://api.data.jambase.com/v3';
const JAMBASE_USER_AGENT = 'Momentum/1.0';

export type JamBaseJson = Record<string, unknown> & {
  success?: boolean;
  errors?: unknown[];
};

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
 * - Edge cache (cf.cacheEverything) so repeat queries hit Cloudflare cache, not JamBase
 * - In-flight deduplication for concurrent identical requests in the same isolate
 */
export async function jamBaseFetch<T extends JamBaseJson>(
  apiKey: string | undefined,
  path: string,
  params: Record<string, string | undefined> = {}
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
