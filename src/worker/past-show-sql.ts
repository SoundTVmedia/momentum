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

/**
 * Latest From the Scene: hide clips whose show start (or recording/upload time)
 * is more than 24 hours ago. Requires `LEFT JOIN jambase_events latest_scene_ev`.
 */
export const LATEST_SCENE_CLIP_FRESH_SQL = `(
  datetime(COALESCE(
    NULLIF(TRIM(IFNULL(latest_scene_ev.start_date, '')), ''),
    NULLIF(TRIM(IFNULL(clips.timestamp, '')), ''),
    clips.created_at
  )) >= datetime('now', '-24 hours')
)`;
