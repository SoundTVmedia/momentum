/**
 * Pure helpers for clip song recognition (ShazamKit primary, ACRCloud
 * fallback via the Worker). No React Native imports so vitest can cover
 * normalization, prefill, and fallback decisions directly.
 */

export type MusicRecognitionProvider = 'shazamkit' | 'acrcloud';

export type MusicRecognitionMatch = {
  title: string;
  artist: string;
  album: string | null;
  genres: string[];
  isrc: string | null;
  appleMusicId: string | null;
  appleMusicUrl: string | null;
  provider: MusicRecognitionProvider;
  confidence: number | null;
};

export type MusicRecognitionStatus = 'matched' | 'no_match' | 'error' | 'unavailable';

/** Serialized with the capture handoff so recognition runs once per capture. */
export type MusicRecognitionOutcome = {
  status: MusicRecognitionStatus;
  match: MusicRecognitionMatch | null;
  provider: MusicRecognitionProvider | null;
  error: string | null;
  completedAt: number;
};

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  const s = trimmedString(value);
  return s === '' ? null : s;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => trimmedString(v)).filter((v) => v !== '');
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Normalize the native ShazamKit payload. Returns null when the payload
 * carries neither a title nor an artist (treated as no-match).
 */
export function normalizeShazamKitMatch(raw: unknown): MusicRecognitionMatch | null {
  if (raw == null || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const title = trimmedString(data.title);
  const artist = trimmedString(data.artist);
  if (!title && !artist) return null;
  return {
    title,
    artist,
    album: nullableString(data.album),
    genres: stringArray(data.genres),
    isrc: nullableString(data.isrc),
    appleMusicId: nullableString(data.appleMusicId),
    appleMusicUrl: nullableString(data.appleMusicUrl),
    provider: 'shazamkit',
    confidence: finiteNumber(data.confidence),
  };
}

/**
 * Normalize the Worker `/api/clips/identify-music` (ACRCloud) response body.
 * Returns null when the response is ok but carries no usable match.
 */
export function normalizeAcrCloudIdentifyMatch(raw: unknown): MusicRecognitionMatch | null {
  if (raw == null || typeof raw !== 'object') return null;
  const body = raw as { ok?: unknown; match?: unknown };
  if (body.ok !== true || body.match == null || typeof body.match !== 'object') return null;
  const match = body.match as Record<string, unknown>;
  const title = trimmedString(match.title);
  const artist = trimmedString(match.artist);
  if (!title && !artist) return null;
  return {
    title,
    artist,
    album: nullableString(match.album),
    genres: [],
    isrc: nullableString(match.isrc),
    appleMusicId: null,
    appleMusicUrl: null,
    provider: 'acrcloud',
    confidence: finiteNumber(match.confidence),
  };
}

export function matchedOutcome(match: MusicRecognitionMatch): MusicRecognitionOutcome {
  return {
    status: 'matched',
    match,
    provider: match.provider,
    error: null,
    completedAt: Date.now(),
  };
}

export function noMatchOutcome(
  provider: MusicRecognitionProvider | null,
): MusicRecognitionOutcome {
  return { status: 'no_match', match: null, provider, error: null, completedAt: Date.now() };
}

export function errorOutcome(
  provider: MusicRecognitionProvider | null,
  error: string,
): MusicRecognitionOutcome {
  return { status: 'error', match: null, provider, error, completedAt: Date.now() };
}

export function unavailableOutcome(): MusicRecognitionOutcome {
  return {
    status: 'unavailable',
    match: null,
    provider: null,
    error: null,
    completedAt: Date.now(),
  };
}

/**
 * ACRCloud stays the fallback: use it when ShazamKit is unavailable
 * (Android, old iOS, dev client without the native module) or when the
 * ShazamKit attempt ended without a match (no-match or error).
 */
export function shouldFallBackToAcrCloud(input: {
  shazamKitAvailable: boolean;
  shazamKitStatus: 'matched' | 'no_match' | 'error' | null;
}): boolean {
  if (!input.shazamKitAvailable) return true;
  return input.shazamKitStatus === 'no_match' || input.shazamKitStatus === 'error';
}

/**
 * Prefill Song/Artist from a recognition match without clobbering values the
 * user already typed (or show-candidate prefill for the artist).
 */
export function applyRecognitionPrefill<
  T extends { song_title: string; artist_name: string },
>(form: T, match: MusicRecognitionMatch | null): T {
  if (!match) return form;
  const next = { ...form };
  if (!next.song_title.trim() && match.title) {
    next.song_title = match.title;
  }
  if (!next.artist_name.trim() && match.artist) {
    next.artist_name = match.artist;
  }
  return next;
}

/** Review-screen status line for the recognition UI state. */
export function recognitionStatusText(
  outcome: MusicRecognitionOutcome | null,
  running: boolean,
): string | null {
  if (running) return 'Identifying song…';
  if (!outcome) return null;
  switch (outcome.status) {
    case 'matched': {
      const m = outcome.match;
      if (!m) return 'Song identified';
      if (m.title && m.artist) return `Song identified: ${m.title} — ${m.artist}`;
      return `Song identified: ${m.title || m.artist}`;
    }
    case 'no_match':
      return 'No song match — enter the song manually.';
    case 'error':
      return outcome.error
        ? `Song ID failed: ${outcome.error}`
        : 'Song ID failed. You can still share.';
    case 'unavailable':
      return 'Song ID is unavailable on this device — enter the song manually.';
    default:
      return null;
  }
}
