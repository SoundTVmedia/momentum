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
export const CLIP_RECORDED_AT_SQL =
  "COALESCE(" +
  "datetime(NULLIF(TRIM(IFNULL(clips.timestamp, '')), '')), " +
  "datetime(clips.created_at), " +
  "clips.created_at)";

/**
 * Clips grouped under one song are ordered by when they were recorded, so the
 * list follows the performances rather than whenever somebody got around to
 * uploading them.
 */
export const SONG_CLIPS_ORDER_BY_SQL = `ORDER BY ${CLIP_RECORDED_AT_SQL} DESC, clips.created_at DESC`;
