/**
 * Canonical SQL identity for a clip's show.
 *
 * New clips store this in show_id. The remaining fallbacks keep older clips
 * grouped by JamBase event or, as a last resort, artist + venue + capture day.
 */
export const CLIP_SHOW_KEY_SQL = `COALESCE(
  NULLIF(TRIM(clips.show_id), ''),
  NULLIF(TRIM(clips.jambase_event_id), ''),
  LOWER(TRIM(clips.artist_name)) || '|' ||
    LOWER(TRIM(clips.venue_name)) || '|' ||
    strftime('%Y-%m-%d', clips.timestamp)
)`;

/** Normalize ISO `T`/`Z` event starts so SQLite datetime() can compare them. */
export const JAMBASE_EVENT_START_DATETIME_SQL = `datetime(replace(replace(substr(TRIM(latest_scene_ev.start_date), 1, 19), 'T', ' '), 'Z', ''))`;

/**
 * Latest From the Scene: hide a clip only when it is tagged to a past show
 * whose start is more than 24 hours ago. Unmatched clips stay in Latest even
 * if they were uploaded after the concert — they just must not use upload
 * recency (or recording time) as a stand-in for "this is a fresh show".
 * Requires `LEFT JOIN jambase_events latest_scene_ev`.
 */
export const LATEST_SCENE_CLIP_FRESH_SQL = `(
  NULLIF(TRIM(IFNULL(clips.jambase_event_id, '')), '') IS NULL
  OR latest_scene_ev.start_date IS NULL
  OR TRIM(latest_scene_ev.start_date) = ''
  OR ${JAMBASE_EVENT_START_DATETIME_SQL} >= datetime('now', '-24 hours')
)`;
