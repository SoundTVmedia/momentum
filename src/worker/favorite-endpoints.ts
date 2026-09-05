import { Context } from 'hono';
import {
  getOrCreateArtistIdByName,
  loadCanonicalFavoriteArtistNames,
  mergeCanonicalNamesForFavoriteBatch,
  mergeProfileFavoriteArtistsJson,
  mochaUserIdKey,
  normalizeArtistDisplayName,
  replaceProfileFavoriteArtistsJsonFromTable,
  syncUserFavoriteArtistRows,
} from './favorite-artists-sync';
import { enrichTrendingArtistsWithJamBase } from './discover-jambase-enrich';
import { jamBaseQuotaFromEnv } from './jambase-client';
import { clientMediaOrigin } from './client-media-origin';
import { rewriteMediaUrlForClient } from '../shared/media-proxy';

type FavoriteArtistRow = {
  name?: string | null;
  artist_id?: number;
  image_url?: string | null;
  bio?: string | null;
};

async function fillMissingFavoriteArtistImages(
  c: Context,
  artists: FavoriteArtistRow[],
): Promise<FavoriteArtistRow[]> {
  const origin = clientMediaOrigin(c);
  const rewrite = (rows: FavoriteArtistRow[]) =>
    rows.map((row) => ({
      ...row,
      image_url: rewriteMediaUrlForClient(row.image_url, origin) ?? row.image_url ?? null,
    }));

  const missing = artists.filter(
    (row) => normalizeArtistDisplayName(String(row.name ?? '')) && !row.image_url?.trim(),
  );
  if (missing.length === 0) return rewrite(artists);

  let next = artists;
  try {
    const names = missing.map((row) => normalizeArtistDisplayName(String(row.name ?? '')));
    const placeholders = names.map(() => '?').join(', ');
    const local = await c.env.DB.prepare(
      `SELECT name, image_url FROM artists
       WHERE TRIM(COALESCE(image_url, '')) != ''
       AND LOWER(TRIM(name)) IN (${placeholders})`,
    )
      .bind(...names.map((name) => name.toLowerCase()))
      .all();

    const byName = new Map<string, string>();
    for (const row of (local.results ?? []) as Array<{ name?: string; image_url?: string | null }>) {
      const key = normalizeArtistDisplayName(String(row.name ?? '')).toLowerCase();
      if (key && row.image_url?.trim()) byName.set(key, row.image_url.trim());
    }

    next = artists.map((row) => {
      const key = normalizeArtistDisplayName(String(row.name ?? '')).toLowerCase();
      if (row.image_url?.trim() || !key) return row;
      const imageUrl = byName.get(key);
      return imageUrl ? { ...row, image_url: imageUrl } : row;
    });

    const stillMissing = next.filter(
      (row) => normalizeArtistDisplayName(String(row.name ?? '')) && !row.image_url?.trim(),
    );
    if (stillMissing.length > 0) {
      const enriched = await enrichTrendingArtistsWithJamBase(
        c.env.JAMBASE_API_KEY,
        jamBaseQuotaFromEnv(c.env),
        stillMissing.map((row) => ({
          name: normalizeArtistDisplayName(String(row.name ?? '')),
          image_url: null,
          clip_count: 0,
          jambase_id: null,
        })),
      );
      const fromJamBase = new Map(
        enriched
          .filter((row) => row.image_url?.trim())
          .map((row) => [row.name.toLowerCase(), row.image_url!.trim()] as const),
      );
      next = next.map((row) => {
        const key = normalizeArtistDisplayName(String(row.name ?? '')).toLowerCase();
        if (row.image_url?.trim() || !key) return row;
        const imageUrl = fromJamBase.get(key);
        return imageUrl ? { ...row, image_url: imageUrl } : row;
      });

      await Promise.all(
        stillMissing.map((row) => {
          const key = normalizeArtistDisplayName(String(row.name ?? '')).toLowerCase();
          const filled = next.find(
            (entry) =>
              normalizeArtistDisplayName(String(entry.name ?? '')).toLowerCase() === key,
          );
          const imageUrl = filled?.image_url?.trim();
          if (!imageUrl) return Promise.resolve();
          const id = Number(row.artist_id);
          if (Number.isFinite(id) && id > 0) {
            return c.env.DB.prepare(
              `UPDATE artists
               SET image_url = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?
               AND (image_url IS NULL OR TRIM(image_url) = '')`,
            )
              .bind(imageUrl, id)
              .run();
          }
          if (!key) return Promise.resolve();
          return c.env.DB.prepare(
            `UPDATE artists
             SET image_url = ?, updated_at = CURRENT_TIMESTAMP
             WHERE LOWER(TRIM(name)) = ?
             AND (image_url IS NULL OR TRIM(image_url) = '')`,
          )
            .bind(imageUrl, key)
            .run();
        }),
      );
    }
  } catch (error) {
    console.warn('Favorite artist image enrich failed:', error);
    next = artists;
  }

  return rewrite(next);
}

/**
 * Get user's favorite artists
 */
export async function getFavoriteArtists(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  try {
    const favorites = await c.env.DB.prepare(
      `SELECT 
        user_favorite_artists.*,
        artists.name,
        artists.image_url,
        artists.bio
      FROM user_favorite_artists
      LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
      WHERE user_favorite_artists.mocha_user_id = ?
      ORDER BY user_favorite_artists.created_at DESC`
    )
      .bind(uid)
      .all();

    const tableArtists = (favorites.results || []) as FavoriteArtistRow[];
    const seen = new Set(
      tableArtists
        .map((row) => normalizeArtistDisplayName(String(row.name ?? '')))
        .filter(Boolean)
        .map((name) => name.toLowerCase()),
    );
    const canonical = await loadCanonicalFavoriteArtistNames(c.env.DB, uid);
    const artists = [...tableArtists];
    for (const name of canonical) {
      if (seen.has(name.toLowerCase())) continue;
      artists.push({ name, artist_id: 0, image_url: null, bio: null });
    }

    const withImages = await fillMissingFavoriteArtistImages(c, artists);
    return c.json({ artists: withImages });
  } catch (error) {
    console.error('Get favorite artists error:', error);
    return c.json({ error: 'Failed to get favorite artists' }, 500);
  }
}

/**
 * Add/remove artist from favorites
 */
export async function toggleFavoriteArtist(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  const body = await c.req.json();
  const { artist_id } = body;

  if (!artist_id) {
    return c.json({ error: 'artist_id is required' }, 400);
  }

  try {
    // Check if already favorited
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?'
    )
      .bind(uid, artist_id)
      .first();

    if (existing) {
      // Remove from favorites
      await c.env.DB.prepare(
        'DELETE FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?'
      )
        .bind(uid, artist_id)
        .run();

      await replaceProfileFavoriteArtistsJsonFromTable(c.env.DB, uid);
      return c.json({ favorited: false });
    } else {
      // Add to favorites
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(uid, artist_id)
        .run();

      await replaceProfileFavoriteArtistsJsonFromTable(c.env.DB, uid);
      return c.json({ favorited: true });
    }
  } catch (error) {
    console.error('Toggle favorite artist error:', error);
    return c.json({ error: 'Failed to update favorite artist' }, 500);
  }
}

/**
 * Favorite a clip (adds to artist section on profile)
 */
export async function favoriteClip(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  const clipId = c.req.param('id');

  try {
    // Get clip with artist info
    const clip = await c.env.DB.prepare(
      'SELECT id, artist_name FROM clips WHERE id = ?'
    )
      .bind(clipId)
      .first() as { id: number; artist_name: string } | null;

    if (!clip) {
      return c.json({ error: 'Clip not found' }, 404);
    }

    if (!clip.artist_name) {
      return c.json({ error: 'Clip has no associated artist' }, 400);
    }

    const artistId = await getOrCreateArtistIdByName(c.env.DB, clip.artist_name);

    // Add artist to favorites if not already there
    const favoriteArtist = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?'
    )
      .bind(uid, artistId)
      .first();

    if (!favoriteArtist) {
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(uid, artistId)
        .run();
      await replaceProfileFavoriteArtistsJsonFromTable(c.env.DB, uid);
    }

    // Check if clip already favorited
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?'
    )
      .bind(uid, artistId, clipId)
      .first();

    if (existing) {
      // Remove from favorites
      await c.env.DB.prepare(
        'DELETE FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?'
      )
        .bind(uid, artistId, clipId)
        .run();

      return c.json({ favorited: false });
    } else {
      // Add to favorites
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_clips_by_artist (mocha_user_id, artist_id, clip_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(uid, artistId, clipId)
        .run();

      return c.json({ favorited: true });
    }
  } catch (error) {
    console.error('Favorite clip error:', error);
    return c.json({ error: 'Failed to favorite clip' }, 500);
  }
}

/**
 * Get user's favorite clips organized by artist
 */
export async function getFavoriteClipsByArtist(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  const artistId = c.req.query('artist_id');

  try {
    let query = `
      SELECT 
        user_favorite_clips_by_artist.*,
        clips.*,
        artists.name as artist_name,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM user_favorite_clips_by_artist
      LEFT JOIN clips ON user_favorite_clips_by_artist.clip_id = clips.id
      LEFT JOIN artists ON user_favorite_clips_by_artist.artist_id = artists.id
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE user_favorite_clips_by_artist.mocha_user_id = ?
    `;

    const bindings: unknown[] = [uid];

    if (artistId) {
      query += ' AND user_favorite_clips_by_artist.artist_id = ?';
      bindings.push(artistId);
    }

    query += ' ORDER BY user_favorite_clips_by_artist.created_at DESC';

    const clips = await c.env.DB.prepare(query)
      .bind(...bindings)
      .all();

    return c.json({ clips: clips.results || [] });
  } catch (error) {
    console.error('Get favorite clips error:', error);
    return c.json({ error: 'Failed to get favorite clips' }, 500);
  }
}

/**
 * Check if a clip is favorited by the current user
 */
export async function checkClipFavorited(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ favorited: false });
  }

  const uid = mochaUserIdKey(mochaUser);

  const clipId = c.req.param('id');

  try {
    const favorited = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND clip_id = ?'
    )
      .bind(uid, clipId)
      .first();

    return c.json({ favorited: !!favorited });
  } catch (error) {
    console.error('Check clip favorited error:', error);
    return c.json({ favorited: false });
  }
}

/**
 * Add artists by display name for Discover "from artists you follow" (user_favorite_artists + artists rows).
 * Merges names into user_profiles.favorite_artists JSON for personalization.
 */
export async function syncFavoriteArtistsByName(c: Context) {
  const mochaUser = c.get('user');

  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);
  if (!uid) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: { names?: unknown; artist_names?: unknown };
  try {
    body = (await c.req.json()) as { names?: unknown; artist_names?: unknown };
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const raw = body.names ?? body.artist_names;
  if (!Array.isArray(raw) || raw.length === 0) {
    return c.json({ error: 'names (non-empty array of strings) is required' }, 400);
  }

  const normalized = [
    ...new Set(raw.map((n) => normalizeArtistDisplayName(String(n ?? ''))).filter(Boolean)),
  ].slice(0, 25);

  try {
    /** Profile JSON first so personalization / onboarding still persist if a row link fails. */
    await mergeProfileFavoriteArtistsJson(c.env.DB, uid, normalized);

    const { synced, failed } = await syncUserFavoriteArtistRows(c.env.DB, uid, normalized);
    try {
      await mergeCanonicalNamesForFavoriteBatch(c.env.DB, uid, normalized);
    } catch (mergeErr) {
      console.error('mergeCanonicalNamesForFavoriteBatch error:', mergeErr);
    }

    return c.json({
      success: true,
      savedToProfile: true,
      synced: synced.length,
      partial: failed.length > 0,
      failed: failed.length > 0 ? failed.map((f) => f.name) : undefined,
      warnings:
        failed.length > 0
          ? failed.map((f) => `${f.name}: ${f.error}`).slice(0, 5)
          : undefined,
    });
  } catch (error) {
    console.error('syncFavoriteArtistsByName error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        error: 'Failed to sync favorite artists',
        detail: msg.length > 180 ? `${msg.slice(0, 180)}…` : msg,
      },
      500,
    );
  }
}
