import { showCalendarDaysApart, showNightKey } from '../shared/show-night-key';

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
  return `strftime('%Y-%m-%d', ${sqlitePlausibleDateTimeSql(`${alias}.timestamp`)})`;
}

function clipVenueKeySql(alias: string): string {
  return `LOWER(REPLACE(REPLACE(TRIM(${alias}.venue_name), CHAR(39), ''), CHAR(8217), ''))`;
}

function clipBilledTitleKeySql(alias: string): string {
  return `(CASE
    WHEN NULLIF(TRIM(${alias}.event_title), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(${alias}.artist_name), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(${alias}.venue_name), '') IS NULL THEN NULL
    ELSE LOWER(TRIM(${alias}.artist_name)) || '|' ||
      ${clipVenueKeySql(alias)} || '|' ||
      LOWER(TRIM(${alias}.event_title))
  END)`;
}

/** Whole UTC days between two clip timestamps, or NULL when either day is missing. */
function clipCaptureDaysApartSql(leftAlias: string, rightAlias: string): string {
  const left = clipCaptureDaySql(leftAlias);
  const right = clipCaptureDaySql(rightAlias);
  return `(CASE
    WHEN ${left} IS NULL OR ${right} IS NULL THEN NULL
    ELSE ABS(julianday(${left}) - julianday(${right}))
  END)`;
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
    WHEN ${clipCaptureDaySql(alias)} IS NULL THEN NULL
    ELSE LOWER(TRIM(${alias}.artist_name)) || '|' ||
      ${clipVenueKeySql(alias)} || '|' ||
      ${clipCaptureDaySql(alias)}
  END)`;
}

export const CLIP_NIGHT_KEY_SQL = clipNightKeySql('clips');

/**
 * Inherit a JamBase event id from a sibling clip on the same concert.
 *
 * Same UTC night covers mixed JamBase + composite ids (Don Toliver / Ariana).
 * Same billed title within one UTC day covers midnight spill, where one clip
 * is tagged `jambase:…` on Sep 19 and another is a slug dated Sep 20.
 */
function inheritJamBaseEventIdSql(alias: string): string {
  const night = clipNightKeySql(alias);
  const seedNight = clipNightKeySql('group_seed');
  const billed = clipBilledTitleKeySql(alias);
  const seedBilled = clipBilledTitleKeySql('group_seed');
  const daysApart = clipCaptureDaysApartSql('group_seed', alias);
  return `(
    SELECT NULLIF(TRIM(group_seed.jambase_event_id), '')
    FROM clips AS group_seed
    WHERE NULLIF(TRIM(group_seed.jambase_event_id), '') IS NOT NULL
      AND (
        (
          ${seedNight} IS NOT NULL
          AND ${night} IS NOT NULL
          AND ${seedNight} = ${night}
        )
        OR (
          ${billed} IS NOT NULL
          AND ${seedBilled} = ${billed}
          AND ${daysApart} IS NOT NULL
          AND ${daysApart} <= 1
        )
      )
    LIMIT 1
  )`;
}

/**
 * Past-show card identity for GROUP BY.
 *
 * 1. Prefer a stored JamBase event id (keeps multi-night residencies separate).
 * 2. Otherwise inherit a JamBase id from another clip on the same concert night
 *    or the same billed title within one UTC day (Foreigner at The Bell
 *    Auditorium midnight spill).
 * 3. Otherwise group by artist + venue + event title so archival uploads with
 *    wrong capture dates still share one card (Charlie Puth at MSG).
 * 4. Last resort: artist + venue + capture day.
 */
export function clipPastShowGroupKeySql(alias = 'clips'): string {
  const billed = clipBilledTitleKeySql(alias);
  return `COALESCE(
    NULLIF(TRIM(${alias}.jambase_event_id), ''),
    ${inheritJamBaseEventIdSql(alias)},
    CASE
      WHEN ${billed} IS NULL THEN NULL
      ELSE 'title:' || ${billed}
    END,
    ${clipNightKeySql(alias)}
  )`;
}

export const CLIP_PAST_SHOW_GROUP_KEY_SQL = clipPastShowGroupKeySql('clips');

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
        COALESCE(
          MIN(CASE
            WHEN ${sqlitePlausibleDateTimeSql('clips.timestamp')} IS NOT NULL
            THEN clips.timestamp
          END),
          MIN(CASE
            WHEN ${sqlitePlausibleDateTimeSql('clips.created_at')} IS NOT NULL
            THEN clips.created_at
          END)
        ) as show_date,
        MAX(clips.venue_name) as venue_name,
        MAX(clips.location) as venue_location,
        MAX(CASE WHEN clips.jambase_event_id IS NOT NULL AND TRIM(clips.jambase_event_id) != '' THEN clips.jambase_event_id END) as jambase_event_id,
        MAX(CASE WHEN clips.jambase_venue_id IS NOT NULL AND TRIM(clips.jambase_venue_id) != '' THEN clips.jambase_venue_id END) as jambase_venue_id,
        MAX(CASE WHEN clips.jambase_artist_id IS NOT NULL AND TRIM(clips.jambase_artist_id) != '' THEN clips.jambase_artist_id END) as jambase_artist_id,
        COUNT(DISTINCT clips.id) as clip_count,${averageRatingSql}
        COALESCE(
          MAX(CASE
            WHEN NULLIF(TRIM(clips.thumbnail_url), '') IS NOT NULL
             AND LOWER(clips.thumbnail_url) NOT LIKE '%.m3u8%'
             AND LOWER(clips.thumbnail_url) NOT LIKE '%.mp4%'
            THEN clips.thumbnail_url
          END),
          MAX(CASE
            WHEN NULLIF(TRIM(clips.stream_thumbnail_url), '') IS NOT NULL
             AND LOWER(clips.stream_thumbnail_url) NOT LIKE '%.m3u8%'
             AND LOWER(clips.stream_thumbnail_url) NOT LIKE '%.mp4%'
            THEN clips.stream_thumbnail_url
          END)
        ) as thumbnail_url,
        MAX(NULLIF(TRIM(clips.stream_video_id), '')) as stream_video_id`;
}

export type PastShowListRow = {
  show_id: string | null;
  event_title: string | null;
  artist_name: string | null;
  show_date: string | null;
  venue_name: string | null;
  venue_location: string | null;
  jambase_event_id: string | null;
  jambase_venue_id: string | null;
  jambase_artist_id: string | null;
  clip_count: number;
  average_show_rating?: number | null;
  thumbnail_url: string | null;
  stream_video_id?: string | null;
  /** JamBase artist photo (`artists.image_url`) when the clip poster is missing. */
  artist_image_url?: string | null;
};

export function libraryShowStubSelectSql(options?: { includeAverageRating?: boolean }): string {
  const averageRatingSql =
    options?.includeAverageRating === false ? '' : `
        NULL as average_show_rating,`;
  return `
        library_shows.jambase_event_id as show_id,
        library_shows.event_title as event_title,
        library_shows.artist_name as artist_name,
        library_shows.start_date as show_date,
        library_shows.venue_name as venue_name,
        library_shows.venue_location as venue_location,
        library_shows.jambase_event_id as jambase_event_id,
        library_shows.jambase_venue_id as jambase_venue_id,
        library_shows.jambase_artist_id as jambase_artist_id,
        0 as clip_count,${averageRatingSql}
        library_shows.thumbnail_url as thumbnail_url`;
}

export function libraryShowNightKeySql(): string {
  return `(CASE
    WHEN NULLIF(TRIM(library_shows.artist_name), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(library_shows.venue_name), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(library_shows.start_date), '') IS NULL THEN NULL
    ELSE LOWER(TRIM(library_shows.artist_name)) || '|' ||
      LOWER(REPLACE(REPLACE(TRIM(library_shows.venue_name), CHAR(39), ''), CHAR(8217), '')) || '|' ||
      strftime('%Y-%m-%d', datetime(replace(replace(substr(TRIM(library_shows.start_date), 1, 19), 'T', ' '), 'Z', '')))
  END)`;
}

function billedShowKey(row: PastShowListRow): string | null {
  const artist = (row.artist_name ?? '').trim().toLowerCase();
  const venue = (row.venue_name ?? '')
    .trim()
    .replace(/['\u2019]/g, '')
    .toLowerCase();
  const title = (row.event_title ?? '').trim().toLowerCase();
  if (!artist || !venue || !title) return null;
  return `${artist}|${venue}|${title}`;
}

function pastShowHasJamBaseId(row: PastShowListRow): boolean {
  return Boolean(row.jambase_event_id?.trim());
}

/** Prefer the card with more clips, then the one that already has a JamBase event id. */
function pastShowCardIsRicher(candidate: PastShowListRow, current: PastShowListRow): boolean {
  const candidateClips = Number(candidate.clip_count) || 0;
  const currentClips = Number(current.clip_count) || 0;
  if (candidateClips !== currentClips) return candidateClips > currentClips;
  return pastShowHasJamBaseId(candidate) && !pastShowHasJamBaseId(current);
}

export function mergeClipAndLibraryPastShows(
  clipShows: PastShowListRow[],
  libraryShows: PastShowListRow[],
  limit: number,
  sortBy: 'date_played' | 'average_rating' = 'date_played',
): PastShowListRow[] {
  const seenIds = new Set<string>();
  const seenNights = new Set<string>();
  const seenTitles = new Set<string>();
  const out: PastShowListRow[] = [];

  const titleKey = (row: PastShowListRow): string | null => {
    if (pastShowHasJamBaseId(row)) return null;
    return billedShowKey(row);
  };

  const remember = (row: PastShowListRow) => {
    const id = (row.jambase_event_id || row.show_id || '').trim();
    const night = showNightKey(row.artist_name, row.venue_name, row.show_date);
    const title = titleKey(row);
    if (id) seenIds.add(id);
    if (night) seenNights.add(night);
    if (title) seenTitles.add(title);
  };

  const take = (row: PastShowListRow) => {
    const id = (row.jambase_event_id || row.show_id || '').trim();
    const night = showNightKey(row.artist_name, row.venue_name, row.show_date);
    const title = titleKey(row);
    if (id && seenIds.has(id)) return;
    if (night && seenNights.has(night)) return;
    if (title && seenTitles.has(title)) return;

    const billed = billedShowKey(row);
    if (billed) {
      const existingIdx = out.findIndex((existing) => billedShowKey(existing) === billed);
      if (existingIdx >= 0) {
        const existing = out[existingIdx]!;
        const existingJb = existing.jambase_event_id?.trim() || '';
        const rowJb = row.jambase_event_id?.trim() || '';
        const bothDistinctJamBase = Boolean(existingJb && rowJb && existingJb !== rowJb);
        const daysApart = showCalendarDaysApart(existing.show_date, row.show_date);
        const sameUtcNight = daysApart != null && daysApart <= 1;
        if (!bothDistinctJamBase && sameUtcNight) {
          out[existingIdx] = pastShowCardIsRicher(row, existing) ? row : existing;
          remember(row);
          remember(existing);
          return;
        }
      }
    }

    remember(row);
    out.push(row);
  };

  for (const row of clipShows) take(row);
  for (const row of libraryShows) take(row);

  if (sortBy === 'average_rating') {
    out.sort(
      (a, b) => (Number(b.average_show_rating) || 0) - (Number(a.average_show_rating) || 0),
    );
  } else {
    out.sort((a, b) => (b.show_date || '').localeCompare(a.show_date || ''));
  }
  return out.slice(0, Math.max(0, limit));
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
 * while others stored the JamBase event id, same-night siblings, and
 * title-matched archival clips when no JamBase event id exists.
 * Bind the same showId nine times.
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
      ${clipPastShowGroupKeySql('clips')} IS NOT NULL
      AND ${clipPastShowGroupKeySql('clips')} IN (
        SELECT ${clipPastShowGroupKeySql('seed')}
        FROM clips AS seed
        WHERE ${clipPastShowGroupKeySql('seed')} IS NOT NULL
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

/** Same as sqliteDateTimeSql, but Unix-epoch / unset metadata become NULL. */
export function sqlitePlausibleDateTimeSql(expr: string): string {
  const dt = sqliteDateTimeSql(expr);
  return `(CASE
    WHEN NULLIF(TRIM(${expr}), '') IS NULL THEN NULL
    WHEN ${dt} IS NULL THEN NULL
    WHEN ${dt} < datetime('1971-01-01') THEN NULL
    ELSE ${dt}
  END)`;
}

export const JAMBASE_EVENT_START_DATETIME_SQL = sqlitePlausibleDateTimeSql(
  'latest_scene_ev.start_date',
);
export const CLIP_RECORDED_DATETIME_SQL = sqlitePlausibleDateTimeSql('clips.timestamp');

/** How far back a tagged show may be and still appear in Latest From the Scene. */
export type LatestSceneEventWindow = '-30 days';

/**
 * Latest From the Scene: keep unmatched clips. For clips tagged to a JamBase
 * event, keep them only if that event happened within `window` of now — not
 * merely because the upload is recent. A late upload to an older past show
 * still belongs on the event page (by recorded time) but should not jump the
 * home Latest grid.
 * Requires `LEFT JOIN jambase_events latest_scene_ev`.
 */
export function latestSceneClipFreshSql(
  window: LatestSceneEventWindow = '-30 days',
): string {
  const eventAtSql = `COALESCE(
    ${JAMBASE_EVENT_START_DATETIME_SQL},
    ${CLIP_RECORDED_DATETIME_SQL}
  )`;
  return `(
  NULLIF(TRIM(IFNULL(clips.jambase_event_id, '')), '') IS NULL
  OR ${eventAtSql} IS NULL
  OR ${eventAtSql} >= datetime('now', '${window}')
)`;
}

/** Tagged shows in Latest must have happened within the last 30 days. */
export const LATEST_SCENE_CLIP_FRESH_SQL = latestSceneClipFreshSql('-30 days');

/**
 * Same 30-day Latest window, plus the logged-in viewer's own posts so they
 * still appear in their home feed after a festival upload.
 */
export function latestSceneClipFreshOrOwnSql(
  viewerUid?: string | null,
  window: LatestSceneEventWindow = '-30 days',
): { sql: string; binds: string[] } {
  const fresh = latestSceneClipFreshSql(window);
  const uid = viewerUid?.trim() || '';
  if (!uid) return { sql: fresh, binds: [] };
  return {
    sql: `(${fresh} OR clips.mocha_user_id = ?)`,
    binds: [uid],
  };
}
