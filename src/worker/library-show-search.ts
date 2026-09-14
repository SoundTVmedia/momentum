import { PUBLIC_VISIBLE_CLIP_SQL } from '../shared/content-feed';
import { FEEDBACK_LIBRARY_SHOW_FLAG } from '../shared/library-shows';
import { CLIP_SHOW_KEY_SQL } from './past-show-sql';

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
  SELECT
    ${CLIP_SHOW_KEY_SQL} as show_id,
    MAX(clips.event_title) as event_title,
    MAX(clips.artist_name) as artist_name,
    MIN(clips.timestamp) as show_date,
    MAX(clips.venue_name) as venue_name,
    MAX(clips.location) as venue_location,
    MAX(CASE WHEN clips.jambase_event_id IS NOT NULL AND TRIM(clips.jambase_event_id) != '' THEN clips.jambase_event_id END) as jambase_event_id,
    MAX(CASE WHEN clips.jambase_venue_id IS NOT NULL AND TRIM(clips.jambase_venue_id) != '' THEN clips.jambase_venue_id END) as jambase_venue_id,
    MAX(CASE WHEN clips.jambase_artist_id IS NOT NULL AND TRIM(clips.jambase_artist_id) != '' THEN clips.jambase_artist_id END) as jambase_artist_id,
    COUNT(DISTINCT clips.id) as clip_count,
    MAX(clips.thumbnail_url) as thumbnail_url
  FROM clips
  WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
  AND (
    IFNULL(clips.event_title, '') LIKE ? COLLATE NOCASE
    OR IFNULL(clips.artist_name, '') LIKE ? COLLATE NOCASE
    OR IFNULL(clips.venue_name, '') LIKE ? COLLATE NOCASE
    OR IFNULL(clips.location, '') LIKE ? COLLATE NOCASE
  )
  GROUP BY ${CLIP_SHOW_KEY_SQL}
  HAVING ${CLIP_SHOW_KEY_SQL} IS NOT NULL AND TRIM(${CLIP_SHOW_KEY_SQL}) != ''
  ORDER BY show_date DESC
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
  return (rows.results ?? []) as LibraryShowSearchRow[];
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
