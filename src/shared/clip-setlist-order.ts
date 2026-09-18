import { displayNamesClose, normalizeArtistDisplayName } from './artist-name-match';
import type { JamBaseSetlistSong } from './jambase-setlist';

/** Spacing used to turn a setlist index into a recorded-time key. */
export const SETLIST_SONG_SPACING_MS = 4 * 60 * 1000;

function songTitleKey(value: string | null | undefined): string {
  return normalizeArtistDisplayName(value ?? '').toLowerCase();
}

/** First setlist row that matches the clip's song title, or null. */
export function setlistIndexForSongTitle(
  setlist: JamBaseSetlistSong[] | null | undefined,
  songTitle: string | null | undefined,
): number | null {
  const title = normalizeArtistDisplayName(songTitle ?? '');
  if (!title || !setlist?.length) return null;
  const key = songTitleKey(title);
  const exact = setlist.findIndex((song) => songTitleKey(song.title) === key);
  if (exact >= 0) return exact;
  const close = setlist.findIndex((song) => displayNamesClose(song.title, title));
  return close >= 0 ? close : null;
}

function parseTimeMs(value: unknown): number | null {
  const parsed = Date.parse(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * When a clip has no capture timestamp, place it on show night at its setlist
 * position so recorded-time ORDER BY still follows the set.
 */
export function clipTimestampFromSetlistOrder(input: {
  eventStartIso: string | null | undefined;
  setlist: JamBaseSetlistSong[] | null | undefined;
  songTitle: string | null | undefined;
}): string | null {
  const index = setlistIndexForSongTitle(input.setlist, input.songTitle);
  if (index == null) return null;
  const startMs = parseTimeMs(input.eventStartIso);
  if (startMs == null) return null;
  return new Date(startMs + index * SETLIST_SONG_SPACING_MS).toISOString();
}

/**
 * Show-clip order key: recorded time, then setlist slot, then uploaded time.
 */
function clipShowOrderMs(
  clip: { song_title?: unknown; timestamp?: unknown; created_at?: unknown },
  setlist: JamBaseSetlistSong[] | null | undefined,
  eventStartMs: number | null,
): number {
  const recordedMs = parseTimeMs(clip.timestamp);
  if (recordedMs != null) return recordedMs;

  const songTitle = typeof clip.song_title === 'string' ? clip.song_title : '';
  const index = setlistIndexForSongTitle(setlist, songTitle);
  if (index != null && eventStartMs != null) {
    return eventStartMs + index * SETLIST_SONG_SPACING_MS;
  }

  const postedMs = parseTimeMs(clip.created_at);
  return postedMs ?? Number.POSITIVE_INFINITY;
}

function clipSongTitle(clip: { song_title?: unknown }): string {
  return typeof clip.song_title === 'string' ? clip.song_title : '';
}

/**
 * Show clips: time recorded first, then setlist order when capture time is
 * missing, then time uploaded.
 */
export function compareShowClipsBySetlistThenRecorded(
  a: { song_title?: unknown; timestamp?: unknown; created_at?: unknown; id?: unknown },
  b: { song_title?: unknown; timestamp?: unknown; created_at?: unknown; id?: unknown },
  setlist: JamBaseSetlistSong[] | null | undefined,
  eventStartIso?: string | null,
): number {
  const recordedA = parseTimeMs(a.timestamp);
  const recordedB = parseTimeMs(b.timestamp);
  if (recordedA != null && recordedB != null && recordedA !== recordedB) {
    return recordedA - recordedB;
  }

  if (recordedA == null && recordedB == null) {
    const ia = setlistIndexForSongTitle(setlist, clipSongTitle(a));
    const ib = setlistIndexForSongTitle(setlist, clipSongTitle(b));
    if (ia != null && ib != null && ia !== ib) return ia - ib;
  }

  const eventStartMs = parseTimeMs(eventStartIso);
  const byTime = clipShowOrderMs(a, setlist, eventStartMs) - clipShowOrderMs(b, setlist, eventStartMs);
  if (byTime !== 0) return byTime;

  const postedA = parseTimeMs(a.created_at) ?? 0;
  const postedB = parseTimeMs(b.created_at) ?? 0;
  if (postedA !== postedB) return postedA - postedB;

  return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { numeric: true });
}

export function sortClipsBySetlistThenRecorded<
  T extends { song_title?: unknown; timestamp?: unknown; created_at?: unknown; id?: unknown },
>(
  clips: T[],
  setlist: JamBaseSetlistSong[] | null | undefined,
  eventStartIso?: string | null,
): T[] {
  return [...clips].sort((a, b) =>
    compareShowClipsBySetlistThenRecorded(a, b, setlist, eventStartIso),
  );
}

export function eventStartIsoFromPayload(
  event: Record<string, unknown> | null | undefined,
): string | null {
  if (!event) return null;
  for (const key of ['startDate', 'start_date'] as const) {
    const value = event[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
