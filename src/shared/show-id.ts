import { slugifyEntityName } from './jambase-slug';

export type ShowIdInput = {
  jambase_event_id?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  timestamp?: string | null;
};

/** UTC calendar day YYYY-MM-DD from an ISO or parseable timestamp. */
export function utcYmdFromTimestamp(timestamp: string): string | null {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Match SQLite's LOWER(TRIM(...)) legacy clip-key normalization. */
function legacySqlText(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.replace(/^ +| +$/g, '').replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/** Legacy clip identity used by CLIP_SHOW_KEY_SQL when no stored event/show id exists. */
export function computeLegacyClipShowKey(input: ShowIdInput): string | null {
  const artist = legacySqlText(input.artist_name);
  const venue = legacySqlText(input.venue_name);
  const timestamp = typeof input.timestamp === 'string' ? input.timestamp : '';
  if (!artist || !venue || !timestamp) return null;

  const day = utcYmdFromTimestamp(timestamp);
  return day ? `${artist}|${venue}|${day}` : null;
}

/** True when the value is a JamBase event identifier (`jambase:…`). */
export function isJamBaseEventId(value: string | null | undefined): boolean {
  const id = typeof value === 'string' ? value.trim() : '';
  return id.startsWith('jambase:');
}

/**
 * Show id for clip → show-page navigation.
 * Prefer a JamBase event id so slug-only rows still match past-show cards when
 * `jambase_event_id` is present (or after sibling backfill).
 */
export function resolveClipShowNavigationId(input: {
  show_id?: string | null;
  jambase_event_id?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  timestamp?: string | null;
}): string | null {
  const jambaseId =
    typeof input.jambase_event_id === 'string' ? input.jambase_event_id.trim() : '';
  if (isJamBaseEventId(jambaseId)) return jambaseId;

  const storedShowId = typeof input.show_id === 'string' ? input.show_id.trim() : '';
  if (isJamBaseEventId(storedShowId)) return storedShowId;
  if (storedShowId) return storedShowId;
  if (jambaseId) return jambaseId;

  return computeLegacyClipShowKey({
    artist_name: input.artist_name,
    venue_name: input.venue_name,
    timestamp: input.timestamp,
  });
}

/**
 * Most common UTC capture day among timestamps (ties → lexicographically earlier day).
 */
export function majorityCaptureDay(
  timestamps: Array<string | null | undefined>,
): string | null {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    if (typeof ts !== 'string' || !ts.trim()) continue;
    const day = utcYmdFromTimestamp(ts);
    if (!day) continue;
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [day, count] of counts) {
    if (count > bestCount || (count === bestCount && best != null && day < best)) {
      best = day;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Clip to use for show-page header fallbacks when JamBase metadata is missing.
 * Prefers the majority capture night so a mis-tagged outlier (e.g. Dec clip
 * stored under a July JamBase id) does not rewrite the page date.
 */
export function pickClipForShowHeader<
  T extends { timestamp?: string | null; jambase_event_id?: string | null },
>(clips: T[]): T | undefined {
  if (clips.length === 0) return undefined;
  const majorityDay = majorityCaptureDay(clips.map((clip) => clip.timestamp));
  const pool =
    majorityDay != null
      ? clips.filter(
          (clip) =>
            typeof clip.timestamp === 'string' &&
            utcYmdFromTimestamp(clip.timestamp) === majorityDay,
        )
      : clips;
  const fromPool = pool.length > 0 ? pool : clips;
  return (
    fromPool.find(
      (clip) => typeof clip.jambase_event_id === 'string' && clip.jambase_event_id.trim(),
    ) ?? fromPool[0]
  );
}

/**
 * Stable show key for grouping clips from the same concert.
 * Prefers JamBase event id; otherwise artist + venue + UTC capture date slug.
 */
export function computeShowId(input: ShowIdInput): string | null {
  const eventId =
    typeof input.jambase_event_id === 'string' ? input.jambase_event_id.trim() : '';
  if (eventId) return eventId;

  const artist = typeof input.artist_name === 'string' ? input.artist_name.trim() : '';
  const venue = typeof input.venue_name === 'string' ? input.venue_name.trim() : '';
  const ts = typeof input.timestamp === 'string' ? input.timestamp.trim() : '';
  if (!artist || !venue || !ts) return null;

  const day = utcYmdFromTimestamp(ts);
  if (!day) return null;

  const artistSlug = slugifyEntityName(artist);
  const venueSlug = slugifyEntityName(venue);
  if (!artistSlug || !venueSlug) return null;

  return `${artistSlug}-${venueSlug}-${day}`;
}
