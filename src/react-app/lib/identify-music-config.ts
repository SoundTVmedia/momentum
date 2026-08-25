/**
 * ACRCloud availability gate for the song-ID fallback.
 *
 * ShazamKit is the primary provider. ACRCloud only runs when the Worker
 * actually has keys, and stops being tried for the rest of the session once it
 * reports an exhausted quota, so a dead fallback never blocks manual entry.
 */

export type IdentifyMusicConfig = {
  activeProvider: 'acrcloud' | 'none';
  ready: boolean;
  hint: string | null;
};

const UNCONFIGURED: IdentifyMusicConfig = {
  activeProvider: 'none',
  ready: false,
  hint: 'Song ID fallback is not configured on the Worker.',
};

let cached: Promise<IdentifyMusicConfig> | null = null;
let exhaustedReason: string | null = null;

/**
 * ACRCloud's own quota/rate-limit codes, where retrying in this session cannot
 * help. Deliberately does not cover our Worker's 429 ("too many song lookups"),
 * which is a local throttle the user clears by waiting a moment.
 */
export function isAcrCloudExhaustedMessage(message: string | null | undefined): boolean {
  const m = message?.trim();
  if (!m) return false;
  return /\b(3003|3015)\b|quota exceeded|rate limit exceeded/i.test(m);
}

/** Config errors mean "never going to work" rather than "no match". */
export function isAcrCloudMisconfiguredMessage(message: string | null | undefined): boolean {
  const m = message?.trim();
  if (!m) return false;
  return /\b(3001|3002|3014)\b|not configured|invalid acrcloud|signature rejected/i.test(m);
}

export function markAcrCloudExhausted(reason: string): void {
  if (exhaustedReason) return;
  exhaustedReason = reason.trim() || 'ACRCloud is unavailable';
  console.warn('[identify] ACRCloud disabled for this session:', exhaustedReason);
}

export function acrCloudExhaustedReason(): string | null {
  return exhaustedReason;
}

export function resetIdentifyMusicConfigCache(): void {
  cached = null;
  exhaustedReason = null;
}

async function loadConfig(): Promise<IdentifyMusicConfig> {
  try {
    const res = await fetch('/api/clips/identify-music/config', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return UNCONFIGURED;
    const data = (await res.json()) as {
      activeProvider?: string;
      acrcloud?: { ready?: boolean };
      hint?: string | null;
    };
    const ready = data.acrcloud?.ready === true && data.activeProvider === 'acrcloud';
    return {
      activeProvider: ready ? 'acrcloud' : 'none',
      ready,
      hint: typeof data.hint === 'string' ? data.hint : null,
    };
  } catch (err) {
    console.warn('[identify] could not read song ID config', err);
    return UNCONFIGURED;
  }
}

export function fetchIdentifyMusicConfig(): Promise<IdentifyMusicConfig> {
  if (!cached) cached = loadConfig();
  return cached;
}

/** True only when the Worker has ACRCloud keys and the quota is not spent. */
export async function isAcrCloudFallbackAvailable(): Promise<boolean> {
  if (exhaustedReason) return false;
  const config = await fetchIdentifyMusicConfig();
  return config.ready;
}
