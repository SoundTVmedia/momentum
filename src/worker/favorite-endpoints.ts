import { Context } from 'hono';
import {
  getOrCreateArtistIdByName,
  mergeProfileFavoriteArtistsJson,
  mochaUserIdKey,
  syncUserFavoriteArtistRows,
} from './favorite-artists-sync';

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

    return c.json({ artists: favorites.results || [] });
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

      return c.json({ favorited: false });
    } else {
      // Add to favorites
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(uid, artist_id)
        .run();

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

  const normalized = [...new Set(raw.map((n) => String(n ?? '').trim()).filter(Boolean))].slice(0, 25);

  try {
    await syncUserFavoriteArtistRows(c.env.DB, uid, normalized);
    await mergeProfileFavoriteArtistsJson(c.env.DB, uid, normalized);

    return c.json({ success: true, synced: normalized.length });
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
