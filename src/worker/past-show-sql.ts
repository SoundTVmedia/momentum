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

/** UTC calendar day from a clip timestamp, including ISO `T`/`Z` values. */
export function clipCaptureDaySql(alias = 'clips'): string {
  return `strftime('%Y-%m-%d', ${sqliteDateTimeSql(`${alias}.timestamp`)})`;
}

/**
 * Same-concert-night identity: artist + venue + capture day.
 * Used to merge clips that stored a JamBase event id as show_id with clips
 * that only stored the composite artist-venue-date slug.
 */
export function clipNightKeySql(alias = 'clips'): string {
  return `(CASE
    WHEN NULLIF(TRIM(${alias}.artist_name), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(${alias}.venue_name), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(${alias}.timestamp), '') IS NULL THEN NULL
    ELSE LOWER(TRIM(${alias}.artist_name)) || '|' ||
      LOWER(REPLACE(REPLACE(TRIM(${alias}.venue_name), CHAR(39), ''), CHAR(8217), '')) || '|' ||
      ${clipCaptureDaySql(alias)}
  END)`;
}

export const CLIP_NIGHT_KEY_SQL = clipNightKeySql('clips');

/** Prefer a JamBase event id when a night group contains mixed show identities. */
export function groupedPastShowIdSql(): string {
  return `COALESCE(
    MAX(CASE WHEN NULLIF(TRIM(clips.jambase_event_id), '') IS NOT NULL THEN TRIM(clips.jambase_event_id) END),
    MAX(${CLIP_SHOW_KEY_SQL})
  )`;
}

export function groupedPastShowsSelectSql(options?: { includeAverageRating?: boolean }): string {
  const averageRatingSql =
    options?.includeAverageRating === false
      ? ''
      : `
        AVG(clips.average_rating) as average_show_rating,`;
  return `
        ${groupedPastShowIdSql()} as show_id,
        MAX(clips.event_title) as event_title,
        MAX(clips.artist_name) as artist_name,
        MIN(clips.timestamp) as show_date,
        MAX(clips.venue_name) as venue_name,
        MAX(clips.location) as venue_location,
        MAX(CASE WHEN clips.jambase_event_id IS NOT NULL AND TRIM(clips.jambase_event_id) != '' THEN clips.jambase_event_id END) as jambase_event_id,
        MAX(CASE WHEN clips.jambase_venue_id IS NOT NULL AND TRIM(clips.jambase_venue_id) != '' THEN clips.jambase_venue_id END) as jambase_venue_id,
        MAX(CASE WHEN clips.jambase_artist_id IS NOT NULL AND TRIM(clips.jambase_artist_id) != '' THEN clips.jambase_artist_id END) as jambase_artist_id,
        COUNT(DISTINCT clips.id) as clip_count,${averageRatingSql}
        MAX(clips.thumbnail_url) as thumbnail_url`;
}

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
 * while others stored the JamBase event id, and clips from the same
 * artist + venue + capture day. Bind the same showId nine times.
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
    OR (
      ${clipNightKeySql('clips')} IS NOT NULL
      AND ${clipNightKeySql('clips')} IN (
        SELECT ${clipNightKeySql('seed')}
        FROM clips AS seed
        WHERE ${clipNightKeySql('seed')} IS NOT NULL
          AND ${clipMatchesShowIdentitySql('seed')}
      )
    )
  )`;
}

export const CLIP_BELONGS_TO_SHOW_BIND_COUNT = CLIP_SHOW_IDENTITY_BIND_COUNT * 3;

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
