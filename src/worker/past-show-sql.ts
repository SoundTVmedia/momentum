import { festivalNamesShareEdition } from '../shared/jambase-festival';
import { isJamBaseEventId } from '../shared/show-id';
import { sameConcertNight } from '../shared/show-night-key';

/**
 * Canonical SQL identity for a clip's show.
 *
 * New clips store this in show_id. The remaining fallbacks keep older clips
 * grouped by JamBase event or, as a last resort, artist + venue + capture day.
 */
export function clipShowKeySql(alias = 'clips'): string {
  return `COALESCE(
  NULLIF(TRIM(${alias}.show_id), ''),
  ${clipRealJamBaseEventIdSql(alias)},
  LOWER(TRIM(${alias}.artist_name)) || '|' ||
    LOWER(TRIM(${alias}.venue_name)) || '|' ||
    strftime('%Y-%m-%d', ${alias}.timestamp)
)`;
}

export const CLIP_SHOW_KEY_SQL = clipShowKeySql('clips');

/**
 * Only real JamBase event ids (`jambase:…`). Composite slugs wrongly stored in
 * `jambase_event_id` must not create a second past-show card or show page.
 */
export function clipRealJamBaseEventIdSql(alias = 'clips'): string {
  return `(CASE
    WHEN TRIM(IFNULL(${alias}.jambase_event_id, '')) LIKE 'jambase:%'
    THEN TRIM(${alias}.jambase_event_id)
    ELSE NULL
  END)`;
}

/**
 * UTC calendar day for concert-night matching.
 * Prefer capture timestamp; fall back to created_at so archival uploads that
 * never stamped `timestamp` (Foreigner Bell Auditorium) still join the night.
 */
export function clipCaptureDaySql(alias = 'clips'): string {
  return `COALESCE(
    strftime('%Y-%m-%d', ${sqlitePlausibleDateTimeSql(`${alias}.timestamp`)}),
    strftime('%Y-%m-%d', ${sqlitePlausibleDateTimeSql(`${alias}.created_at`)})
  )`;
}

function clipLooseNameSql(expr: string): string {
  return `LOWER(REPLACE(REPLACE(REPLACE(TRIM(${expr}), '-', ' '), CHAR(39), ''), CHAR(8217), ''))`;
}

function clipVenueKeySql(alias: string): string {
  return clipLooseNameSql(`${alias}.venue_name`);
}

function clipArtistKeySql(alias: string): string {
  return clipLooseNameSql(`${alias}.artist_name`);
}

export function clipBilledTitleKeySql(alias: string): string {
  return `(CASE
    WHEN NULLIF(TRIM(${alias}.event_title), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(${alias}.artist_name), '') IS NULL THEN NULL
    WHEN NULLIF(TRIM(${alias}.venue_name), '') IS NULL THEN NULL
    ELSE ${clipArtistKeySql(alias)} || '|' ||
      ${clipVenueKeySql(alias)} || '|' ||
      ${clipLooseNameSql(`${alias}.event_title`)}
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
    ELSE ${clipArtistKeySql(alias)} || '|' ||
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
  const seedJamBase = clipRealJamBaseEventIdSql('group_seed');
  return `(
    SELECT ${seedJamBase}
    FROM clips AS group_seed
    WHERE ${seedJamBase} IS NOT NULL
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
        OR (
          ${billed} IS NOT NULL
          AND ${seedBilled} = ${billed}
          AND ${clipCaptureDaySql(alias)} IS NULL
          AND (
            SELECT COUNT(DISTINCT ${clipRealJamBaseEventIdSql('jb')})
            FROM clips AS jb
            WHERE ${clipRealJamBaseEventIdSql('jb')} IS NOT NULL
              AND ${clipBilledTitleKeySql('jb')} = ${billed}
          ) = 1
        )
      )
    ORDER BY group_seed.id ASC
    LIMIT 1
  )`;
}

/**
 * One JamBase id for every clip on the same artist + venue + UTC day.
 * Duplicate listings of one concert (two `jambase:` ids for Jay-Z at Yankee
 * Stadium) share that id. A different calendar day keeps its own id, so a
 * two-night residency stays two shows.
 */
function sameNightCanonicalJamBaseIdSql(alias: string): string {
  const night = clipNightKeySql(alias);
  const mateNight = clipNightKeySql('night_mate');
  const mateJamBase = clipRealJamBaseEventIdSql('night_mate');
  return `(
    SELECT MIN(${mateJamBase})
    FROM clips AS night_mate
    WHERE ${mateJamBase} IS NOT NULL
      AND ${night} IS NOT NULL
      AND ${mateNight} = ${night}
  )`;
}

/**
 * Past-show card identity for GROUP BY.
 *
 * 1. Same artist + venue + UTC day shares one JamBase id, even when listings
 *    disagree (Jay-Z at Yankee Stadium).
 * 2. Otherwise a stored JamBase event id (keeps multi-night residencies separate).
 * 3. Otherwise inherit a JamBase id from another clip on the same concert night
 *    or the same billed title within one UTC day (Foreigner at The Bell
 *    Auditorium midnight spill).
 * 4. Otherwise group by artist + venue + event title so archival uploads with
 *    wrong capture dates still share one card (Charlie Puth at MSG).
 * 5. Last resort: artist + venue + capture day.
 */
export function clipPastShowGroupKeySql(alias = 'clips'): string {
  const billed = clipBilledTitleKeySql(alias);
  return `COALESCE(
    ${sameNightCanonicalJamBaseIdSql(alias)},
    ${clipRealJamBaseEventIdSql(alias)},
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
    MAX(${clipRealJamBaseEventIdSql('clips')}),
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
        MAX(${clipRealJamBaseEventIdSql('clips')}) as jambase_event_id,
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
  /** Other show / event ids that were collapsed into this card. */
  identity_ids?: string[];
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
    ELSE ${clipLooseNameSql('library_shows.artist_name')} || '|' ||
      ${clipLooseNameSql('library_shows.venue_name')} || '|' ||
      strftime('%Y-%m-%d', datetime(replace(replace(substr(TRIM(library_shows.start_date), 1, 19), 'T', ' '), 'Z', '')))
  END)`;
}

/** Compare show names ignoring case, hyphens, and apostrophes ("Jay-Z" / "Jay Z"). */
export function concertNameKey(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function concertNamesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = concertNameKey(left);
  const b = concertNameKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

function billedShowKey(row: PastShowListRow): string | null {
  const artist = concertNameKey(row.artist_name);
  const venue = concertNameKey(row.venue_name);
  const title = concertNameKey(row.event_title);
  if (!artist || !venue || !title) return null;
  return `${artist}|${venue}|${title}`;
}

function pastShowIdentityIds(row: PastShowListRow): string[] {
  const ids = [row.show_id, row.jambase_event_id, ...(row.identity_ids ?? [])];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = (raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sameFestivalEdition(left: PastShowListRow, right: PastShowListRow): boolean {
  return festivalNamesShareEdition(
    left.event_title,
    right.event_title,
    left.show_date,
    right.show_date,
  );
}

/**
 * True when two cards, marks, or clips are the same concert.
 * Distinct JamBase ids on different nights stay separate (residencies).
 * The same night, the same billed show, or the same festival edition collapse.
 */
export function pastShowsAreSameConcert(left: PastShowListRow, right: PastShowListRow): boolean {
  const rightIds = new Set(pastShowIdentityIds(right));
  if (pastShowIdentityIds(left).some((id) => rightIds.has(id))) return true;
  if (sameFestivalEdition(left, right)) return true;

  if (
    sameConcertNight(left.show_date, right.show_date) &&
    concertNamesMatch(left.artist_name, right.artist_name) &&
    concertNamesMatch(left.venue_name, right.venue_name)
  ) {
    return true;
  }

  const leftBilled = billedShowKey(left);
  const rightBilled = billedShowKey(right);
  if (!leftBilled || leftBilled !== rightBilled) return false;

  const leftJamBase = isJamBaseEventId(left.jambase_event_id) ? left.jambase_event_id!.trim() : '';
  const rightJamBase = isJamBaseEventId(right.jambase_event_id)
    ? right.jambase_event_id!.trim()
    : '';
  const bothDistinctJamBase = Boolean(leftJamBase && rightJamBase && leftJamBase !== rightJamBase);
  if (bothDistinctJamBase) return sameConcertNight(left.show_date, right.show_date);
  return true;
}

function pastShowHasJamBaseId(row: PastShowListRow): boolean {
  return isJamBaseEventId(row.jambase_event_id);
}

/** Prefer the card with more clips, then the one that already has a JamBase event id. */
function pastShowCardIsRicher(candidate: PastShowListRow, current: PastShowListRow): boolean {
  const candidateClips = Number(candidate.clip_count) || 0;
  const currentClips = Number(current.clip_count) || 0;
  if (candidateClips !== currentClips) return candidateClips > currentClips;
  return pastShowHasJamBaseId(candidate) && !pastShowHasJamBaseId(current);
}

function preferredShowId(row: PastShowListRow, ids: string[]): string | null {
  const jamBase = ids.find((id) => isJamBaseEventId(id));
  if (jamBase) return jamBase;
  return row.show_id ?? row.jambase_event_id ?? ids[0] ?? null;
}

export function mergePastShowPair(current: PastShowListRow, incoming: PastShowListRow): PastShowListRow {
  const richer = pastShowCardIsRicher(incoming, current) ? incoming : current;
  const poorer = richer === incoming ? current : incoming;
  const ids = [...new Set([...pastShowIdentityIds(current), ...pastShowIdentityIds(incoming)])];
  const jamBase = ids.find((id) => isJamBaseEventId(id)) ?? richer.jambase_event_id ?? null;
  return {
    ...richer,
    clip_count: (Number(current.clip_count) || 0) + (Number(incoming.clip_count) || 0),
    jambase_event_id: jamBase,
    show_id: preferredShowId(richer, ids),
    thumbnail_url: richer.thumbnail_url || poorer.thumbnail_url,
    artist_image_url: richer.artist_image_url || poorer.artist_image_url,
    identity_ids: ids,
  };
}

/** Collapse cards that are the same concert, summing clip counts. */
export function collapsePastShowRows(rows: PastShowListRow[]): PastShowListRow[] {
  const out: PastShowListRow[] = [];
  for (const row of rows) {
    const idx = out.findIndex((existing) => pastShowsAreSameConcert(existing, row));
    if (idx < 0) {
      out.push({ ...row, identity_ids: pastShowIdentityIds(row) });
      continue;
    }
    out[idx] = mergePastShowPair(out[idx]!, row);
  }
  return out;
}

/**
 * When a new clip or mark is the same concert as one we already have, keep the
 * existing identity so it does not mint a second past-show card.
 */
export function pickCanonicalShowIdentity(
  incoming: PastShowListRow,
  existing: PastShowListRow[],
): PastShowListRow | null {
  const matches = existing.filter((row) => pastShowsAreSameConcert(incoming, row));
  if (matches.length === 0) return null;
  const ranked = [...matches].sort((a, b) => {
    const aJamBase = pastShowHasJamBaseId(a) ? 1 : 0;
    const bJamBase = pastShowHasJamBaseId(b) ? 1 : 0;
    if (aJamBase !== bJamBase) return bJamBase - aJamBase;
    return (Number(b.clip_count) || 0) - (Number(a.clip_count) || 0);
  });
  const chosen = ranked[0]!;
  const chosenId = (isJamBaseEventId(chosen.jambase_event_id) ? chosen.jambase_event_id : chosen.show_id) ?? '';
  const incomingId =
    (isJamBaseEventId(incoming.jambase_event_id) ? incoming.jambase_event_id : incoming.show_id) ?? '';
  if (chosenId.trim() && chosenId.trim() === incomingId.trim()) return null;
  return chosen;
}

export function mergeClipAndLibraryPastShows(
  clipShows: PastShowListRow[],
  libraryShows: PastShowListRow[],
  limit: number,
  sortBy: 'date_played' | 'average_rating' = 'date_played',
): PastShowListRow[] {
  const out = collapsePastShowRows([...clipShows, ...libraryShows]);

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
      ${clipRealJamBaseEventIdSql('clips')} IS NOT NULL
      AND ${clipRealJamBaseEventIdSql('clips')} IN (
        SELECT ${clipRealJamBaseEventIdSql('seed')}
        FROM clips AS seed
        WHERE ${clipRealJamBaseEventIdSql('seed')} IS NOT NULL
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
      ${clipRealJamBaseEventIdSql('clips')} IS NOT NULL
      AND ${clipRealJamBaseEventIdSql('clips')} IN (
        SELECT ${clipRealJamBaseEventIdSql('titled')}
        FROM clips AS titled
        WHERE titled.event_title = ?
          AND ${clipRealJamBaseEventIdSql('titled')} IS NOT NULL
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
  ${clipRealJamBaseEventIdSql('clips')} IS NULL
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
