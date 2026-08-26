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

/** Normalize ISO `T`/`Z` timestamps so SQLite datetime() can compare them. */
function sqliteDateTimeSql(expr: string): string {
  return `datetime(replace(replace(substr(TRIM(${expr}), 1, 19), 'T', ' '), 'Z', ''))`;
}

export const JAMBASE_EVENT_START_DATETIME_SQL = sqliteDateTimeSql(
  'latest_scene_ev.start_date',
);
export const CLIP_CREATED_DATETIME_SQL = sqliteDateTimeSql('clips.created_at');

export type LatestScenePostWindow = '+24 hours' | '+30 days';

/**
 * Latest From the Scene: keep unmatched clips. For clips tagged to a JamBase
 * event, keep them only if they were posted within `window` of that event start.
 * Requires `LEFT JOIN jambase_events latest_scene_ev`.
 */
export function latestSceneClipFreshSql(window: LatestScenePostWindow): string {
  return `(
  NULLIF(TRIM(IFNULL(clips.jambase_event_id, '')), '') IS NULL
  OR latest_scene_ev.start_date IS NULL
  OR TRIM(latest_scene_ev.start_date) = ''
  OR ${CLIP_CREATED_DATETIME_SQL} <= datetime(${JAMBASE_EVENT_START_DATETIME_SQL}, '${window}')
)`;
}

/** Prefer clips posted within 24 hours of the associated show. */
export const LATEST_SCENE_CLIP_FRESH_SQL = latestSceneClipFreshSql('+24 hours');

/** Fallback when the 24-hour Latest window is empty. */
export const LATEST_SCENE_CLIP_FRESH_30D_SQL = latestSceneClipFreshSql('+30 days');
