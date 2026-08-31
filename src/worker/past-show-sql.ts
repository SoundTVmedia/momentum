/**
 * Canonical SQL identity for a clip's show.
 *
 * New clips store this in show_id. The remaining fallbacks keep older clips
 * grouped by JamBase event or, as a last resort, artist + venue + capture day.
 */
export function clipShowKeySql(alias = 'clips'): string {
  return `COALESCE(
  NULLIF(TRIM(${alias}.show_id), ''),
  NULLIF(TRIM(${alias}.jambase_event_id), ''),
  LOWER(TRIM(${alias}.artist_name)) || '|' ||
    LOWER(TRIM(${alias}.venue_name)) || '|' ||
    strftime('%Y-%m-%d', ${alias}.timestamp)
)`;
}

export const CLIP_SHOW_KEY_SQL = clipShowKeySql('clips');

/**
 * Match a requested show URL id against stored show_id, JamBase event id, or
 * the computed show key. Bind the same showId three times.
 */
export function clipMatchesShowIdentitySql(alias = 'clips'): string {
  return `(
    ${clipShowKeySql(alias)} = ?
    OR NULLIF(TRIM(${alias}.show_id), '') = ?
    OR NULLIF(TRIM(${alias}.jambase_event_id), '') = ?
  )`;
}

export const CLIP_SHOW_IDENTITY_BIND_COUNT = 3;

/**
 * All clips for a show page, including rows that stored a composite show_id
 * while others stored the JamBase event id. Bind the same showId six times.
 */
export function clipBelongsToRequestedShowSql(): string {
  return `(
    ${clipMatchesShowIdentitySql('clips')}
    OR (
      NULLIF(TRIM(clips.jambase_event_id), '') IS NOT NULL
      AND TRIM(clips.jambase_event_id) IN (
        SELECT TRIM(seed.jambase_event_id)
        FROM clips AS seed
        WHERE NULLIF(TRIM(seed.jambase_event_id), '') IS NOT NULL
          AND ${clipMatchesShowIdentitySql('seed')}
      )
    )
  )`;
}

export const CLIP_BELONGS_TO_SHOW_BIND_COUNT = CLIP_SHOW_IDENTITY_BIND_COUNT * 2;

/** Bind the event title three times. */
export function clipBelongsToEventTitleSql(): string {
  return `(
    clips.event_title = ?
    OR ${CLIP_SHOW_KEY_SQL} IN (
      SELECT ${clipShowKeySql('titled')}
      FROM clips AS titled
      WHERE titled.event_title = ?
        AND NULLIF(TRIM(${clipShowKeySql('titled')}), '') IS NOT NULL
    )
    OR (
      NULLIF(TRIM(clips.jambase_event_id), '') IS NOT NULL
      AND TRIM(clips.jambase_event_id) IN (
        SELECT TRIM(titled.jambase_event_id)
        FROM clips AS titled
        WHERE titled.event_title = ?
          AND NULLIF(TRIM(titled.jambase_event_id), '') IS NOT NULL
      )
    )
  )`;
}

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
