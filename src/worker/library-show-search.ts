import { PUBLIC_VISIBLE_CLIP_SQL } from '../shared/content-feed';
import {
  ALREADY_IN_LIBRARY_FLAG,
  FEEDBACK_LIBRARY_SHOW_FLAG,
} from '../shared/library-shows';
import {
  jamBaseEventArtistName,
  jamBaseEventId,
  jamBaseEventVenueName,
} from '../shared/jambase-events';
import { showNightKey } from '../shared/show-night-key';
import {
  CLIP_NIGHT_KEY_SQL,
  groupedPastShowsSelectSql,
  libraryShowStubSelectSql,
  mergeClipAndLibraryPastShows,
  type PastShowListRow,
} from './past-show-sql';

export type LibraryShowSearchRow = {
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
  thumbnail_url: string | null;
};

/** Bind the same LIKE four times, then LIMIT. */
export const LIBRARY_SHOW_SEARCH_SQL = `
  SELECT ${groupedPastShowsSelectSql({ includeAverageRating: false })}
  FROM clips
  WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
  AND (
    IFNULL(clips.event_title, '') LIKE ? COLLATE NOCASE
    OR IFNULL(clips.artist_name, '') LIKE ? COLLATE NOCASE
    OR IFNULL(clips.venue_name, '') LIKE ? COLLATE NOCASE
    OR IFNULL(clips.location, '') LIKE ? COLLATE NOCASE
  )
  GROUP BY ${CLIP_NIGHT_KEY_SQL}
  HAVING ${CLIP_NIGHT_KEY_SQL} IS NOT NULL
  ORDER BY show_date DESC
  LIMIT ?
`;

/** Bind the same LIKE four times, then LIMIT. */
export const LIBRARY_SHOW_STUB_SEARCH_SQL = `
  SELECT ${libraryShowStubSelectSql({ includeAverageRating: false })}
  FROM library_shows
  WHERE (
    IFNULL(library_shows.event_title, '') LIKE ? COLLATE NOCASE
    OR IFNULL(library_shows.artist_name, '') LIKE ? COLLATE NOCASE
    OR IFNULL(library_shows.venue_name, '') LIKE ? COLLATE NOCASE
    OR IFNULL(library_shows.venue_location, '') LIKE ? COLLATE NOCASE
  )
  ORDER BY library_shows.start_date DESC
  LIMIT ?
`;

export function libraryShowToJamBaseEvent(show: LibraryShowSearchRow): Record<string, unknown> {
  const eventId = (show.jambase_event_id || show.show_id || '').trim();
  const artistName = show.artist_name?.trim() || '';
  const venueName = show.venue_name?.trim() || '';
  const cityLine = show.venue_location?.trim() || '';
  return {
    identifier: eventId,
    name: show.event_title?.trim() || '',
    startDate: show.show_date?.trim() || '',
    image: show.thumbnail_url?.trim() || null,
    performer: artistName
      ? [
          {
            name: artistName,
            identifier: show.jambase_artist_id?.trim() || '',
            'x-isHeadliner': true,
          },
        ]
      : [],
    location: {
      name: venueName,
      identifier: show.jambase_venue_id?.trim() || '',
      address: cityLine ? { addressLocality: cityLine } : undefined,
    },
    [FEEDBACK_LIBRARY_SHOW_FLAG]: true,
    'x-clipCount': Number(show.clip_count) || 0,
    'x-feedbackShowId': show.show_id?.trim() || eventId,
  };
}

export async function searchLibraryShows(
  db: D1Database,
  query: string,
  maxResults = 18,
): Promise<LibraryShowSearchRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const limit = Math.min(Math.max(maxResults, 1), 40);
  const rows = await db
    .prepare(LIBRARY_SHOW_SEARCH_SQL)
    .bind(like, like, like, like, String(limit))
    .all();
  const clipShows = (rows.results ?? []) as PastShowListRow[];

  let stubShows: PastShowListRow[] = [];
  try {
    const stubs = await db
      .prepare(LIBRARY_SHOW_STUB_SEARCH_SQL)
      .bind(like, like, like, like, String(limit))
      .all();
    stubShows = (stubs.results ?? []) as PastShowListRow[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/no such table: library_shows/i.test(message)) throw err;
  }

  return mergeClipAndLibraryPastShows(clipShows, stubShows, limit) as LibraryShowSearchRow[];
}

export async function libraryEventsForFindAShow(
  db: D1Database,
  query: string,
  maxResults: number,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await searchLibraryShows(db, query, maxResults);
    return rows.map(libraryShowToJamBaseEvent);
  } catch (err) {
    console.error('Library show search error:', err);
    return [];
  }
}

export async function markEventsAlreadyInLibrary(
  db: D1Database,
  events: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (events.length === 0) return events;
  const ids = events
    .map((ev) => jamBaseEventId(ev))
    .filter((id): id is string => Boolean(id));
  const nights = events
    .map((ev) =>
      showNightKey(
        jamBaseEventArtistName(ev),
        jamBaseEventVenueName(ev) === 'Venue TBA' ? '' : jamBaseEventVenueName(ev),
        typeof ev.startDate === 'string' ? ev.startDate : null,
      ),
    )
    .filter((key): key is string => Boolean(key));

  const existingIds = new Set<string>();
  const existingNights = new Set<string>();

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    try {
      const clipIds = await db
        .prepare(
          `SELECT DISTINCT TRIM(jambase_event_id) as id
           FROM clips
           WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
           AND NULLIF(TRIM(jambase_event_id), '') IS NOT NULL
           AND TRIM(jambase_event_id) IN (${placeholders})`,
        )
        .bind(...ids)
        .all<{ id: string }>();
      for (const row of clipIds.results ?? []) {
        if (row.id) existingIds.add(row.id);
      }
    } catch (err) {
      console.error('markEventsAlreadyInLibrary clips', err);
    }
    try {
      const stubIds = await db
        .prepare(
          `SELECT jambase_event_id as id
           FROM library_shows
           WHERE jambase_event_id IN (${placeholders})`,
        )
        .bind(...ids)
        .all<{ id: string }>();
      for (const row of stubIds.results ?? []) {
        if (row.id) existingIds.add(row.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/no such table: library_shows/i.test(message)) {
        console.error('markEventsAlreadyInLibrary stubs', err);
      }
    }
  }

  if (nights.length > 0) {
    const placeholders = nights.map(() => '?').join(',');
    try {
      const clipNights = await db
        .prepare(
          `SELECT DISTINCT ${CLIP_NIGHT_KEY_SQL} as night_key
           FROM clips
           WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
           AND ${CLIP_NIGHT_KEY_SQL} IN (${placeholders})`,
        )
        .bind(...nights)
        .all<{ night_key: string }>();
      for (const row of clipNights.results ?? []) {
        if (row.night_key) existingNights.add(row.night_key);
      }
    } catch (err) {
      console.error('markEventsAlreadyInLibrary nights', err);
    }
  }

  for (const ev of events) {
    if (ev[FEEDBACK_LIBRARY_SHOW_FLAG] === true) {
      ev[ALREADY_IN_LIBRARY_FLAG] = true;
      continue;
    }
    const id = jamBaseEventId(ev);
    const night = showNightKey(
      jamBaseEventArtistName(ev),
      jamBaseEventVenueName(ev) === 'Venue TBA' ? '' : jamBaseEventVenueName(ev),
      typeof ev.startDate === 'string' ? ev.startDate : null,
    );
    if ((id && existingIds.has(id)) || (night && existingNights.has(night))) {
      ev[ALREADY_IN_LIBRARY_FLAG] = true;
    }
  }
  return events;
}
