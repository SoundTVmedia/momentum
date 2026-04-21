import { Context } from 'hono';

/**
 * Get user's favorite artists
 */
export async function getFavoriteArtists(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

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
      .bind(mochaUser.id)
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
      .bind(mochaUser.id, artist_id)
      .first();

    if (existing) {
      // Remove from favorites
      await c.env.DB.prepare(
        'DELETE FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?'
      )
        .bind(mochaUser.id, artist_id)
        .run();

      return c.json({ favorited: false });
    } else {
      // Add to favorites
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(mochaUser.id, artist_id)
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

    // Get or create artist
    let artist = await c.env.DB.prepare(
      'SELECT id FROM artists WHERE name = ?'
    )
      .bind(clip.artist_name)
      .first() as { id: number } | null;

    if (!artist) {
      const result = await c.env.DB.prepare(
        'INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
      )
        .bind(clip.artist_name)
        .run();
      
      artist = { id: result.meta.last_row_id as number };
    }

    // Add artist to favorites if not already there
    const favoriteArtist = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?'
    )
      .bind(mochaUser.id, artist.id)
      .first();

    if (!favoriteArtist) {
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(mochaUser.id, artist.id)
        .run();
    }

    // Check if clip already favorited
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?'
    )
      .bind(mochaUser.id, artist.id, clipId)
      .first();

    if (existing) {
      // Remove from favorites
      await c.env.DB.prepare(
        'DELETE FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?'
      )
        .bind(mochaUser.id, artist.id, clipId)
        .run();

      return c.json({ favorited: false });
    } else {
      // Add to favorites
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_clips_by_artist (mocha_user_id, artist_id, clip_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(mochaUser.id, artist.id, clipId)
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

    const bindings: any[] = [mochaUser.id];

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

  const clipId = c.req.param('id');

  try {
    const favorited = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND clip_id = ?'
    )
      .bind(mochaUser.id, clipId)
      .first();

    return c.json({ favorited: !!favorited });
  } catch (error) {
    console.error('Check clip favorited error:', error);
    return c.json({ favorited: false });
  }
}
