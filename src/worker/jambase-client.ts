const JAMBASE_V3_BASE = 'https://api.data.jambase.com/v3';
const JAMBASE_USER_AGENT = 'Momentum/1.0';

export type JamBaseJson = Record<string, unknown> & {
  success?: boolean;
  errors?: unknown[];
};

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

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'User-Agent': JAMBASE_USER_AGENT,
    },
  });

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
}

export function jamBaseEventDateFromToday(): string {
  return new Date().toISOString().split('T')[0];
}
