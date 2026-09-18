/**
 * `clips.timestamp` is when the clip was recorded (the show); `clips.created_at`
 * is when it was posted. The two are stored in different shapes — `timestamp`
 * is ISO-8601 from the client (`2026-08-22T01:25:38.211Z`) and `created_at` is
 * SQLite's `CURRENT_TIMESTAMP` (`2026-08-23 00:54:40`) — so comparing them as
 * raw text interleaves them wrongly. `datetime()` parses both and normalizes to
 * `YYYY-MM-DD HH:MM:SS`.
 *
 * Falls back to the posted time for older rows with no capture timestamp.
 */
function sqliteDateTimeSql(expr: string): string {
  return `datetime(replace(replace(substr(TRIM(${expr}), 1, 19), 'T', ' '), 'Z', ''))`;
}

export const CLIP_RECORDED_AT_SQL =
  "COALESCE(" +
  `${sqliteDateTimeSql("NULLIF(TRIM(IFNULL(clips.timestamp, '')), '')")}, ` +
  `${sqliteDateTimeSql('clips.created_at')}, ` +
  "clips.created_at)";

/** Recorded time for inserting a late upload into setlist order. */
export function clipRecordedAtMs(clip: {
  timestamp?: unknown;
  created_at?: unknown;
}): number {
  const recorded = Date.parse(String(clip.timestamp ?? '').trim());
  if (Number.isFinite(recorded)) return recorded;
  const posted = Date.parse(String(clip.created_at ?? '').trim());
  return Number.isFinite(posted) ? posted : 0;
}

export function compareClipsByRecordedTimeAsc(
  a: { timestamp?: unknown; created_at?: unknown; id?: unknown },
  b: { timestamp?: unknown; created_at?: unknown; id?: unknown },
): number {
  const byTime = clipRecordedAtMs(a) - clipRecordedAtMs(b);
  if (byTime !== 0) return byTime;
  const postedA = Date.parse(String(a.created_at ?? '').trim());
  const postedB = Date.parse(String(b.created_at ?? '').trim());
  if (Number.isFinite(postedA) && Number.isFinite(postedB) && postedA !== postedB) {
    return postedA - postedB;
  }
  return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, {
    numeric: true,
  });
}

/**
 * Clips grouped under one song are ordered by when they were recorded, so the
 * list follows the performances rather than whenever somebody got around to
 * uploading them.
 */
export const SONG_CLIPS_ORDER_BY_SQL = `ORDER BY ${CLIP_RECORDED_AT_SQL} DESC, clips.created_at DESC`;

/**
 * Show pages: oldest recorded clip first so the grid follows the set.
 * SQL cannot see the setlist or whether a timestamp is actually show night;
 * callers then re-sort recorded (show night) → setlist → uploaded.
 */
export const SHOW_CLIPS_RECORDED_ORDER_BY_SQL = `ORDER BY ${CLIP_RECORDED_AT_SQL} ASC, clips.created_at ASC, clips.id ASC`;
