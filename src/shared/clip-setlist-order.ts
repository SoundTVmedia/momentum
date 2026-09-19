import { displayNamesClose, normalizeArtistDisplayName } from './artist-name-match';
import { jamBaseEventMatchesCapture } from './jambase-event-day';
import type { JamBaseSetlistSong } from './jambase-setlist';
import { isoFromEventStart, parseShowTimeMs } from './show-timestamp';

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
  return parseShowTimeMs(value);
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

function eventForShowNight(
  eventStartIso?: string | null,
  event?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (event && typeof event === 'object') return event;
  const start = typeof eventStartIso === 'string' ? eventStartIso.trim() : '';
  return start ? { startDate: start } : null;
}

/**
 * Recorded time only counts as show-night capture when matching a JamBase event.
 * Used at ingest so a library file dated today is not treated as concert time.
 */
export function clipRecordedAtOnShowNightMs(
  clip: { timestamp?: unknown },
  event: Record<string, unknown> | null,
): number | null {
  const recordedMs = parseTimeMs(clip.timestamp);
  if (recordedMs == null) return null;
  if (event && !jamBaseEventMatchesCapture(event, recordedMs)) return null;
  return recordedMs;
}

/** File / capture timestamp to store when it is actually the night of this show. */
export function showNightRecordedAtIso(
  timestamp: unknown,
  event: Record<string, unknown> | null,
): string | null {
  if (clipRecordedAtOnShowNightMs({ timestamp }, event) == null) return null;
  const raw = typeof timestamp === 'string' ? timestamp.trim() : '';
  return raw || null;
}

function clipSongTitle(clip: { song_title?: unknown }): string {
  return typeof clip.song_title === 'string' ? clip.song_title : '';
}

function medianMs(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function interpolateSetlistMs(
  index: number,
  recordedByIndex: Map<number, number[]>,
  eventStartMs: number | null,
  setlistLength: number,
): number | null {
  let prevIdx: number | null = null;
  let prevMs: number | null = null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const peers = recordedByIndex.get(i);
    if (peers?.length) {
      prevIdx = i;
      prevMs = medianMs(peers);
      break;
    }
  }
  let nextIdx: number | null = null;
  let nextMs: number | null = null;
  for (let i = index + 1; i < setlistLength; i += 1) {
    const peers = recordedByIndex.get(i);
    if (peers?.length) {
      nextIdx = i;
      nextMs = medianMs(peers);
      break;
    }
  }
  if (prevMs != null && nextMs != null && prevIdx != null && nextIdx != null && nextIdx !== prevIdx) {
    return prevMs + ((nextMs - prevMs) * (index - prevIdx)) / (nextIdx - prevIdx);
  }
  if (prevMs != null && prevIdx != null) {
    return prevMs + (index - prevIdx) * SETLIST_SONG_SPACING_MS;
  }
  if (nextMs != null && nextIdx != null) {
    return nextMs - (nextIdx - index) * SETLIST_SONG_SPACING_MS;
  }
  if (eventStartMs != null) return eventStartMs + index * SETLIST_SONG_SPACING_MS;
  return null;
}

function recordedSortKeyMs(
  clip: { song_title?: unknown; timestamp?: unknown; created_at?: unknown },
  recordedMs: number | null,
  setlist: JamBaseSetlistSong[] | null | undefined,
  recordedByIndex: Map<number, number[]>,
  eventStartMs: number | null,
): number {
  if (recordedMs != null) return recordedMs;
  const index = setlistIndexForSongTitle(setlist, clipSongTitle(clip));
  if (index != null) {
    const peers = recordedByIndex.get(index);
    if (peers?.length) return medianMs(peers);
    const interpolated = interpolateSetlistMs(
      index,
      recordedByIndex,
      eventStartMs,
      setlist?.length ?? 0,
    );
    if (interpolated != null) return interpolated;
  }
  return parseTimeMs(clip.created_at) ?? Number.POSITIVE_INFINITY;
}

/**
 * Show clips: oldest recorded time first so late uploads slot into the set.
 * Missing capture time falls back to setlist position, then time uploaded.
 * Equal recorded times (date-only metadata) break ties by setlist, then upload.
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

  const ia = setlistIndexForSongTitle(setlist, clipSongTitle(a));
  const ib = setlistIndexForSongTitle(setlist, clipSongTitle(b));
  if (ia != null && ib != null && ia !== ib) return ia - ib;

  const eventStartMs = parseTimeMs(eventStartIso);
  const keyA =
    recordedA ??
    (ia != null && eventStartMs != null ? eventStartMs + ia * SETLIST_SONG_SPACING_MS : parseTimeMs(a.created_at)) ??
    Number.POSITIVE_INFINITY;
  const keyB =
    recordedB ??
    (ib != null && eventStartMs != null ? eventStartMs + ib * SETLIST_SONG_SPACING_MS : parseTimeMs(b.created_at)) ??
    Number.POSITIVE_INFINITY;
  if (keyA !== keyB) return keyA - keyB;

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
  event?: Record<string, unknown> | null,
): T[] {
  const showEvent = eventForShowNight(eventStartIso, event);
  const eventStartMs =
    parseTimeMs(eventStartIso) ?? parseTimeMs(eventStartIsoFromPayload(showEvent));
  const recordedMs = clips.map((clip) => parseTimeMs(clip.timestamp));
  const recordedByIndex = new Map<number, number[]>();
  clips.forEach((clip, i) => {
    const rec = recordedMs[i];
    if (rec == null) return;
    const index = setlistIndexForSongTitle(setlist, clipSongTitle(clip));
    if (index == null) return;
    const peers = recordedByIndex.get(index) ?? [];
    peers.push(rec);
    recordedByIndex.set(index, peers);
  });

  const decorated = clips.map((clip, i) => ({
    clip,
    key: recordedSortKeyMs(clip, recordedMs[i], setlist, recordedByIndex, eventStartMs),
    index: setlistIndexForSongTitle(setlist, clipSongTitle(clip)),
  }));
  decorated.sort((a, b) => {
    if (a.key !== b.key) return a.key - b.key;
    if (a.index != null && b.index != null && a.index !== b.index) return a.index - b.index;
    const postedA = parseTimeMs(a.clip.created_at) ?? 0;
    const postedB = parseTimeMs(b.clip.created_at) ?? 0;
    if (postedA !== postedB) return postedA - postedB;
    return String(a.clip.id ?? '').localeCompare(String(b.clip.id ?? ''), undefined, {
      numeric: true,
    });
  });
  return decorated.map((row) => row.clip);
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

/** Recorded-time stand-in when a tagged clip has no capture metadata. */
export function clipTimestampFromEventStart(
  eventStartIso: string | null | undefined,
): string | null {
  return isoFromEventStart(eventStartIso);
}
