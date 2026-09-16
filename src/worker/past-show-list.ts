import { PUBLIC_VISIBLE_CLIP_SQL } from '../shared/content-feed';
import { displayNamesClose } from '../shared/artist-name-match';
import { isUsablePosterImageUrl } from '../shared/clip-poster-url';
import { slugifyEntityName } from '../shared/jambase-slug';
import { lookupArtistIdByName, lookupVenueIdByName } from './jambase-cache';
import {
  CLIP_NIGHT_KEY_SQL,
  groupedPastShowsSelectSql,
  libraryShowNightKeySql,
  libraryShowStubSelectSql,
  mergeClipAndLibraryPastShows,
  type PastShowListRow,
} from './past-show-sql';

function artistImageLookupKeys(name: string | null | undefined): string[] {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return [];
  const keys = [trimmed.toLowerCase()];
  const slug = slugifyEntityName(trimmed);
  if (slug && slug !== keys[0]) keys.push(slug);
  return keys;
}

/** Stamp JamBase artist photos onto past-show rows by artist name. */
export function applyArtistImagesToPastShows(
  rows: PastShowListRow[],
  imagesByArtist: Map<string, string>,
): PastShowListRow[] {
  if (imagesByArtist.size === 0) return rows;
  return rows.map((row) => {
    if (isUsablePosterImageUrl(row.artist_image_url)) return row;
    for (const key of artistImageLookupKeys(row.artist_name)) {
      const image = imagesByArtist.get(key);
      if (isUsablePosterImageUrl(image)) {
        return { ...row, artist_image_url: image };
      }
    }
    return row;
  });
}

function indexArtistImage(map: Map<string, string>, name: string, imageUrl: string) {
  const image = imageUrl.trim();
  if (!isUsablePosterImageUrl(image)) return;
  for (const key of artistImageLookupKeys(name)) {
    if (!map.has(key)) map.set(key, image);
  }
}

/** Fill missing past-show art from `artists.image_url` (JamBase artist photos). */
export async function attachPastShowArtistImages(
  db: D1Database,
  rows: PastShowListRow[],
): Promise<PastShowListRow[]> {
  const names = [
    ...new Set(rows.map((row) => row.artist_name?.trim() ?? '').filter((name) => name.length >= 2)),
  ];
  if (names.length === 0) return rows;

  const images = new Map<string, string>();
  const chunkSize = 30;
  for (let i = 0; i < names.length; i += chunkSize) {
    const chunk = names.slice(i, i + chunkSize);
    const slugs = chunk.map((name) => slugifyEntityName(name)).filter(Boolean);
    const namePlaceholders = chunk.map(() => '?').join(',');
    const slugSql =
      slugs.length > 0
        ? ` OR LOWER(REPLACE(TRIM(name), ' ', '-')) IN (${slugs.map(() => '?').join(',')})`
        : '';
    try {
      const result = await db
        .prepare(
          `SELECT name, image_url FROM artists
           WHERE TRIM(IFNULL(image_url, '')) != ''
           AND (
             LOWER(TRIM(name)) IN (${namePlaceholders})
             ${slugSql}
           )`,
        )
        .bind(...chunk.map((name) => name.toLowerCase()), ...slugs)
        .all();
      for (const row of (result.results ?? []) as Array<{ name?: string; image_url?: string }>) {
        if (typeof row.name === 'string' && typeof row.image_url === 'string') {
          indexArtistImage(images, row.name, row.image_url);
        }
      }
    } catch {
      /* missing artists table or image_url should not hide past shows */
    }
  }
  return applyArtistImagesToPastShows(rows, images);
}

function isMissingLibraryShowsTable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no such table: library_shows/i.test(message);
}

export function libraryStubMatchesEntity(
  row: PastShowListRow,
  opts: {
    artistName?: string;
    venueName?: string;
    artistId?: string;
    venueId?: string;
  },
): boolean {
  const artistName = opts.artistName?.trim() ?? '';
  const venueName = opts.venueName?.trim() ?? '';
  if (artistName) {
    const artistId = opts.artistId?.trim() ?? '';
    if (artistId && row.jambase_artist_id?.trim() === artistId) return true;
    if (displayNamesClose(row.artist_name, artistName)) return true;
    const a = slugifyEntityName(row.artist_name);
    const b = slugifyEntityName(artistName);
    return Boolean(a && b && a === b);
  }
  if (venueName) {
    const venueId = opts.venueId?.trim() ?? '';
    if (venueId && row.jambase_venue_id?.trim() === venueId) return true;
    if (displayNamesClose(row.venue_name, venueName)) return true;
    const a = slugifyEntityName(row.venue_name);
    const b = slugifyEntityName(venueName);
    return Boolean(a && b && a === b);
  }
  return false;
}

function dedupeLibraryStubs(rows: PastShowListRow[]): PastShowListRow[] {
  const seen = new Set<string>();
  const out: PastShowListRow[] = [];
  for (const row of rows) {
    const key = (row.jambase_event_id || row.show_id || '').trim() || JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function loadLibraryShowStubs(
  db: D1Database,
  opts: {
    artistName?: string;
    venueName?: string;
    limit: number;
    includeAverageRating?: boolean;
  },
): Promise<PastShowListRow[]> {
  const artistName = opts.artistName?.trim() ?? '';
  const venueName = opts.venueName?.trim() ?? '';
  if (!artistName && !venueName) return [];

  const select = libraryShowStubSelectSql({ includeAverageRating: opts.includeAverageRating });
  const fetchLimit = Math.max(opts.limit * 8, 80);
  const cached = artistName
    ? await lookupArtistIdByName(db, artistName)
    : await lookupVenueIdByName(db, venueName);
  const entityId = cached?.jambase_id?.trim() ?? '';
  const entity = artistName || venueName;
  const idColumn = artistName ? 'library_shows.jambase_artist_id' : 'library_shows.jambase_venue_id';
  const nameColumn = artistName ? 'library_shows.artist_name' : 'library_shows.venue_name';

  const where = entityId
    ? `(${nameColumn} = ? COLLATE NOCASE OR ${idColumn} = ?)`
    : `${nameColumn} = ? COLLATE NOCASE`;
  const matchBindings = entityId ? [entity, entityId, String(fetchLimit)] : [entity, String(fetchLimit)];

  try {
    const matched = await db
      .prepare(
        `SELECT ${select}
         FROM library_shows
         WHERE ${where}
         ORDER BY library_shows.start_date DESC
         LIMIT ?`,
      )
      .bind(...matchBindings)
      .all();

    const recent = await db
      .prepare(
        `SELECT ${select}
         FROM library_shows
         ORDER BY library_shows.start_date DESC
         LIMIT ?`,
      )
      .bind(String(fetchLimit))
      .all();

    const rows = dedupeLibraryStubs([
      ...((matched.results ?? []) as PastShowListRow[]),
      ...((recent.results ?? []) as PastShowListRow[]),
    ]).filter((row) =>
      libraryStubMatchesEntity(row, {
        artistName: artistName || undefined,
        venueName: venueName || undefined,
        artistId: artistName ? entityId : undefined,
        venueId: venueName ? entityId : undefined,
      }),
    );
    return rows.slice(0, opts.limit);
  } catch (err) {
    if (isMissingLibraryShowsTable(err)) return [];
    throw err;
  }
}

export async function loadClipPastShows(
  db: D1Database,
  opts: {
    artistName?: string;
    venueName?: string;
    limit: number;
    includeAverageRating?: boolean;
  },
): Promise<PastShowListRow[]> {
  const artistName = opts.artistName?.trim() ?? '';
  const venueName = opts.venueName?.trim() ?? '';
  if (!artistName && !venueName) return [];

  const column = artistName ? 'clips.artist_name' : 'clips.venue_name';
  const entity = artistName || venueName;
  const sql = `
    SELECT ${groupedPastShowsSelectSql({ includeAverageRating: opts.includeAverageRating })}
    FROM clips
    WHERE ${column} = ?
    AND ${PUBLIC_VISIBLE_CLIP_SQL}
    AND clips.event_title IS NOT NULL
    AND TRIM(clips.event_title) != ''
    GROUP BY ${CLIP_NIGHT_KEY_SQL}
    ORDER BY show_date DESC
    LIMIT ?
  `;
  const rows = await db.prepare(sql).bind(entity, String(opts.limit)).all();
  return (rows.results ?? []) as PastShowListRow[];
}

export async function loadClipPastShowsForSong(
  db: D1Database,
  songSlug: string,
  limit: number,
): Promise<PastShowListRow[]> {
  const slug = songSlug.trim();
  if (!slug || limit <= 0) return [];

  const sql = `
    SELECT ${groupedPastShowsSelectSql({ includeAverageRating: true })}
    FROM clips
    WHERE clips.song_slug = ?
    AND ${PUBLIC_VISIBLE_CLIP_SQL}
    AND clips.event_title IS NOT NULL
    AND TRIM(clips.event_title) != ''
    GROUP BY ${CLIP_NIGHT_KEY_SQL}
    ORDER BY show_date DESC
    LIMIT ?
  `;
  const rows = await db.prepare(sql).bind(slug, String(limit)).all();
  return (rows.results ?? []) as PastShowListRow[];
}

export async function listPastShowsForEntity(
  db: D1Database,
  opts: {
    artistName?: string;
    venueName?: string;
    limit: number;
    offset?: number;
    sortBy?: 'date_played' | 'average_rating';
  },
): Promise<PastShowListRow[]> {
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(0, opts.limit);
  const fetchLimit = offset + limit;

  const [clipShows, libraryShows] = await Promise.all([
    loadClipPastShows(db, { ...opts, limit: fetchLimit, includeAverageRating: true }),
    loadLibraryShowStubs(db, { ...opts, limit: fetchLimit, includeAverageRating: true }),
  ]);

  const merged = mergeClipAndLibraryPastShows(
    clipShows,
    libraryShows,
    fetchLimit,
    opts.sortBy ?? 'date_played',
  );
  return attachPastShowArtistImages(db, merged.slice(offset, offset + limit));
}

export async function findExistingLibraryShow(
  db: D1Database,
  jambaseEventId: string,
  nightKey: string | null,
): Promise<PastShowListRow | null> {
  const eventId = jambaseEventId.trim();
  if (eventId) {
    try {
      const stub = await db
        .prepare(
          `SELECT ${libraryShowStubSelectSql()}
           FROM library_shows
           WHERE jambase_event_id = ?
           LIMIT 1`,
        )
        .bind(eventId)
        .first<PastShowListRow>();
      if (stub) return stub;
    } catch (err) {
      if (!isMissingLibraryShowsTable(err)) throw err;
    }

    const clip = await db
      .prepare(
        `SELECT ${groupedPastShowsSelectSql()}
         FROM clips
         WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
         AND TRIM(clips.jambase_event_id) = ?
         GROUP BY ${CLIP_NIGHT_KEY_SQL}
         LIMIT 1`,
      )
      .bind(eventId)
      .first<PastShowListRow>();
    if (clip) return clip;
  }

  if (nightKey) {
    const clipNight = await db
      .prepare(
        `SELECT ${groupedPastShowsSelectSql()}
         FROM clips
         WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
         AND ${CLIP_NIGHT_KEY_SQL} = ?
         GROUP BY ${CLIP_NIGHT_KEY_SQL}
         LIMIT 1`,
      )
      .bind(nightKey)
      .first<PastShowListRow>();
    if (clipNight) return clipNight;

    try {
      const stubNight = await db
        .prepare(
          `SELECT ${libraryShowStubSelectSql()}
           FROM library_shows
           WHERE ${libraryShowNightKeySql()} = ?
           LIMIT 1`,
        )
        .bind(nightKey)
        .first<PastShowListRow>();
      if (stubNight) return stubNight;
    } catch (err) {
      if (!isMissingLibraryShowsTable(err)) throw err;
    }
  }

  return null;
}
