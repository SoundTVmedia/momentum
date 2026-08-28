import type { Context } from 'hono';
import {
  favoriteEntityKey,
  isUserFavoriteType,
  type UserFavoriteType,
} from '../shared/user-favorites';
import { songSlugFromTitle, songTitleFromSlug } from '../shared/song-tag';
import { PUBLIC_VISIBLE_CLIP_SQL } from '../shared/content-feed';
import {
  mergeCanonicalNamesForFavoriteBatch,
  mergeProfileFavoriteArtistsJson,
  mochaUserIdKey,
  normalizeArtistDisplayName,
  syncUserFavoriteArtistRows,
} from './favorite-artists-sync';
import { resolveVenueIdForFollow } from './follow-endpoints';
import {
  jamBaseFetch,
  jamBaseQuotaFromEnv,
  type JamBaseFetchDiag,
} from './jambase-client';
import { fetchJamBaseEventsByArtistName } from './jambase-endpoints';
import { clientMediaOrigin } from './client-media-origin';
import { rewriteJamBaseEventImages, rewriteMediaUrlForClient } from '../shared/media-proxy';
import { archivalShowDateKey } from '../shared/archival-show';
import { searchFeedbackUsersByText } from './search-users';

async function upsertFavoriteRow(
  db: D1Database,
  uid: string,
  type: UserFavoriteType,
  entityKey: string,
  displayName: string,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO user_favorites (mocha_user_id, favorite_type, entity_key, display_name, metadata_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(mocha_user_id, favorite_type, entity_key) DO UPDATE SET
           display_name = excluded.display_name,
           metadata_json = COALESCE(excluded.metadata_json, user_favorites.metadata_json)`,
      )
      .bind(uid, type, entityKey, displayName, metadata ? JSON.stringify(metadata) : null)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/no such table: user_favorites/i.test(message)) return;
    throw err;
  }
}

async function addArtistFavorite(db: D1Database, uid: string, rawName: string): Promise<void> {
  const name = normalizeArtistDisplayName(rawName);
  if (!name) throw new Error('Artist name is required');
  await mergeProfileFavoriteArtistsJson(db, uid, [name]);
  await syncUserFavoriteArtistRows(db, uid, [name]);
  try {
    await mergeCanonicalNamesForFavoriteBatch(db, uid, [name]);
  } catch (err) {
    console.error('addArtistFavorite mergeCanonical:', err);
  }
  await upsertFavoriteRow(db, uid, 'artist', name.toLowerCase(), name, null);
}

async function addVenueFavorite(
  db: D1Database,
  uid: string,
  venueName: string,
  jambaseId?: string | null,
): Promise<number> {
  const name = venueName.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Venue name is required');
  const venueId = await resolveVenueIdForFollow(db, 0, {
    venue_name: name,
    jambase_id: jambaseId ?? undefined,
  });
  if (venueId == null) throw new Error('Could not resolve venue');
  const target = `venue-${venueId}`;
  const existing = await db
    .prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?')
    .bind(uid, target)
    .first();
  if (!existing) {
    await db
      .prepare(
        'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      )
      .bind(uid, target)
      .run();
  }
  await upsertFavoriteRow(db, uid, 'venue', String(venueId), name, {
    venue_id: venueId,
    jambase_id: jambaseId ?? null,
  });
  return venueId;
}

async function addSongFavorite(db: D1Database, uid: string, titleOrSlug: string): Promise<string> {
  const slug =
    songSlugFromTitle(titleOrSlug) || favoriteEntityKey('song', titleOrSlug);
  if (!slug) throw new Error('Song title is required');
  const display = songTitleFromSlug(slug);
  await upsertFavoriteRow(db, uid, 'song', slug, display, null);
  return slug;
}

export async function listMyFavorites(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);
  const uid = mochaUserIdKey(mochaUser);
  const typeFilter = c.req.query('type');

  try {
    const sql = typeFilter && isUserFavoriteType(typeFilter)
      ? `SELECT * FROM user_favorites WHERE mocha_user_id = ? AND favorite_type = ? ORDER BY created_at DESC`
      : `SELECT * FROM user_favorites WHERE mocha_user_id = ? ORDER BY created_at DESC`;
    const stmt = typeFilter && isUserFavoriteType(typeFilter)
      ? c.env.DB.prepare(sql).bind(uid, typeFilter)
      : c.env.DB.prepare(sql).bind(uid);
    const rows = await stmt.all();
    return c.json({ favorites: rows.results ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/no such table: user_favorites/i.test(message)) {
      return c.json({ favorites: [] });
    }
    console.error('listMyFavorites', err);
    return c.json({ error: 'Failed to load favorites' }, 500);
  }
}

export async function addMyFavorite(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);
  const uid = mochaUserIdKey(mochaUser);

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const type = body.type;
  if (!isUserFavoriteType(type) || type === 'archival_show') {
    return c.json({ error: 'type must be artist, venue, or song' }, 400);
  }

  try {
    if (type === 'artist') {
      const name = typeof body.name === 'string' ? body.name : '';
      await addArtistFavorite(c.env.DB, uid, name);
      return c.json({ ok: true, type, name: normalizeArtistDisplayName(name) });
    }
    if (type === 'venue') {
      const name = typeof body.name === 'string' ? body.name : '';
      const jambaseId = typeof body.jambase_id === 'string' ? body.jambase_id : null;
      const venueId = await addVenueFavorite(c.env.DB, uid, name, jambaseId);
      return c.json({ ok: true, type, venue_id: venueId, name: name.trim() });
    }
    const title = typeof body.name === 'string' ? body.name : typeof body.slug === 'string' ? body.slug : '';
    const slug = await addSongFavorite(c.env.DB, uid, title);
    return c.json({ ok: true, type, slug });
  } catch (err) {
    console.error('addMyFavorite', err);
    const message = err instanceof Error ? err.message : 'Failed to save favorite';
    return c.json({ error: message }, 400);
  }
}

export async function removeMyFavorite(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);
  const uid = mochaUserIdKey(mochaUser);
  const type = c.req.param('type');
  const key = decodeURIComponent(c.req.param('entityKey') ?? '').trim();
  if (!isUserFavoriteType(type) || !key) {
    return c.json({ error: 'type and entity key are required' }, 400);
  }

  try {
    await c.env.DB
      .prepare(
        `DELETE FROM user_favorites
         WHERE mocha_user_id = ? AND favorite_type = ? AND LOWER(entity_key) = LOWER(?)`,
      )
      .bind(uid, type, key)
      .run();
    return c.json({ ok: true });
  } catch (err) {
    console.error('removeMyFavorite', err);
    return c.json({ error: 'Failed to remove favorite' }, 500);
  }
}

function eventArtistName(ev: Record<string, unknown>): string {
  const perf = ev.performer;
  if (Array.isArray(perf) && perf[0] && typeof perf[0] === 'object') {
    const name = (perf[0] as Record<string, unknown>).name;
    if (typeof name === 'string') return name;
  }
  return typeof ev.name === 'string' ? ev.name : '';
}

function eventVenueName(ev: Record<string, unknown>): string {
  const loc = ev.location;
  if (loc && typeof loc === 'object') {
    const name = (loc as Record<string, unknown>).name;
    if (typeof name === 'string') return name;
  }
  return '';
}

/** One search box: artists, friends, venues, songs, and archival/live shows. */
export async function unifiedFavoritesSearch(c: Context) {
  const q = (c.req.query('q') || '').trim();
  if (q.length < 2) {
    return c.json({ artists: [], venues: [], shows: [], friends: [], songs: [] });
  }

  const mochaUser = c.get('user');
  const uid = mochaUser ? mochaUserIdKey(mochaUser) : '';
  const origin = clientMediaOrigin(c);
  const titleLike = `%${q}%`;
  const slugHint = songSlugFromTitle(q) || q.toLowerCase();
  const slugLike = `%${slugHint}%`;

  const friendsPromise = searchFeedbackUsersByText(c.env.DB, q, 8).then((rows) =>
    rows
      .filter((row) => row.mocha_user_id !== uid)
      .map((row) => ({
        mocha_user_id: row.mocha_user_id,
        display_name: row.display_name,
        profile_image_url: rewriteMediaUrlForClient(row.profile_image_url, origin),
        clip_count: row.clip_count,
      })),
  );

  const songsPromise = c.env.DB
    .prepare(
      `SELECT
        clips.song_slug as slug,
        MAX(clips.song_title) as title,
        MAX(clips.artist_name) as artist_name,
        COUNT(DISTINCT clips.id) as clip_count
      FROM clips
      WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
      AND clips.song_slug IS NOT NULL
      AND TRIM(clips.song_slug) != ''
      AND (
        clips.song_title LIKE ? COLLATE NOCASE OR
        clips.song_slug LIKE ? COLLATE NOCASE
      )
      GROUP BY clips.song_slug
      ORDER BY clip_count DESC
      LIMIT 8`,
    )
    .bind(titleLike, slugLike)
    .all()
    .then(
      (rows: {
        results?: { slug: string; title: string | null; artist_name: string | null; clip_count: number }[];
      }) =>
        (rows.results ?? []).map((row) => ({
          slug: row.slug,
          title: (row.title && row.title.trim()) || songTitleFromSlug(row.slug),
          artist_name: row.artist_name,
          clip_count: Number(row.clip_count) || 0,
        })),
    );

  const key = typeof c.env.JAMBASE_API_KEY === 'string' ? c.env.JAMBASE_API_KEY : '';
  if (!key.trim()) {
    const [friends, songs] = await Promise.all([friendsPromise, songsPromise]);
    return c.json({
      artists: [],
      venues: [],
      shows: [],
      friends,
      songs,
      notice: 'JamBase is not configured',
    });
  }

  const jbQ = jamBaseQuotaFromEnv(c.env);
  const aDiag: JamBaseFetchDiag = {};
  const vDiag: JamBaseFetchDiag = {};

  const [artistsData, venuesData, artistShows, friends, songs] = await Promise.all([
    jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
      key,
      '/artists',
      { artistName: q, perPage: '8', page: '1' },
      jbQ,
      aDiag,
    ),
    jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
      key,
      '/venues',
      { venueName: q, perPage: '8', page: '1' },
      jbQ,
      vDiag,
    ),
    fetchJamBaseEventsByArtistName(key, jbQ, q, '12'),
    friendsPromise,
    songsPromise,
  ]);

  const artists = (artistsData?.artists ?? []).slice(0, 8).map((row) => {
    const image = typeof row.image === 'string' ? rewriteMediaUrlForClient(row.image, origin) : null;
    return {
      identifier: typeof row.identifier === 'string' ? row.identifier : '',
      name: typeof row.name === 'string' ? row.name : '',
      image,
    };
  });

  const venues = (venuesData?.venues ?? []).slice(0, 8).map((row) => {
    const image = typeof row.image === 'string' ? rewriteMediaUrlForClient(row.image, origin) : null;
    const loc = row.location && typeof row.location === 'object'
      ? (row.location as Record<string, unknown>)
      : null;
    const city = typeof loc?.addressLocality === 'string'
      ? loc.addressLocality
      : typeof loc?.city === 'string'
        ? loc.city
        : '';
    return {
      identifier: typeof row.identifier === 'string' ? row.identifier : '',
      name: typeof row.name === 'string' ? row.name : '',
      city,
      image,
    };
  });

  const shows = (artistShows.events ?? [])
    .slice(0, 8)
    .map((ev) => rewriteJamBaseEventImages(ev, origin))
    .map((ev) => ({
      identifier: typeof ev.identifier === 'string' ? ev.identifier : '',
      name: typeof ev.name === 'string' ? ev.name : '',
      startDate: typeof ev.startDate === 'string' ? ev.startDate : archivalShowDateKey(String(ev.startDate ?? '')),
      artistName: eventArtistName(ev),
      venueName: eventVenueName(ev),
      image: typeof ev.image === 'string' ? ev.image : null,
    }));

  return c.json({ artists, venues, shows, friends, songs });
}
