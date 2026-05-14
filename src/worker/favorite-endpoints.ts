import { Context } from 'hono';

/** Stable TEXT key for D1 `mocha_user_id` columns (Mocha may supply number or string). */
function mochaUserIdKey(user: { id: unknown }): string {
  return String(user.id ?? '').trim();
}

async function getOrCreateArtistIdByName(db: D1Database, displayName: string): Promise<number> {
  const name = displayName.trim();
  if (!name) {
    throw new Error('empty artist name');
  }

  let row = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(name).first()) as { id: unknown } | null;
  let id = row?.id != null ? Number(row.id) : NaN;
  if (Number.isFinite(id) && id > 0) {
    return id;
  }

  try {
    const ins = await db
      .prepare(
        'INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      )
      .bind(name)
      .run();
    const lid = ins.meta?.last_row_id;
    const n = typeof lid === 'number' && Number.isFinite(lid) && lid > 0 ? lid : NaN;
    if (Number.isFinite(n) && n > 0) {
      const verify = (await db.prepare('SELECT id FROM artists WHERE id = ?').bind(n).first()) as { id: unknown } | null;
      const vid = verify?.id != null ? Number(verify.id) : NaN;
      if (Number.isFinite(vid) && vid > 0) {
        return vid;
      }
    }
  } catch {
    /* UNIQUE(name) race — re-select below */
  }

  row = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(name).first()) as { id: unknown } | null;
  id = row?.id != null ? Number(row.id) : NaN;
  if (Number.isFinite(id) && id > 0) {
    return id;
  }

  throw new Error('Could not resolve artist id');
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
      .bind(uid, artist.id)
      .first();

    if (!favoriteArtist) {
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(uid, artist.id)
        .run();
    }

    // Check if clip already favorited
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?'
    )
      .bind(uid, artist.id, clipId)
      .first();

    if (existing) {
      // Remove from favorites
      await c.env.DB.prepare(
        'DELETE FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?'
      )
        .bind(uid, artist.id, clipId)
        .run();

      return c.json({ favorited: false });
    } else {
      // Add to favorites
      await c.env.DB.prepare(
        'INSERT INTO user_favorite_clips_by_artist (mocha_user_id, artist_id, clip_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
      )
        .bind(uid, artist.id, clipId)
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

    const bindings: any[] = [uid];

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
    for (const name of normalized) {
      const artistId = await getOrCreateArtistIdByName(c.env.DB, name);

      const existing = await c.env.DB
        .prepare('SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?')
        .bind(uid, artistId)
        .first();

      if (!existing) {
        await c.env.DB
          .prepare(
            'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          )
          .bind(uid, artistId)
          .run();
      }
    }

    const profile = (await c.env.DB
      .prepare('SELECT id, favorite_artists FROM user_profiles WHERE mocha_user_id = ?')
      .bind(uid)
      .first()) as { id: unknown; favorite_artists: string | null } | null;

    let mergedNames: string[] = [...normalized];
    if (profile?.favorite_artists) {
      try {
        const parsed = JSON.parse(profile.favorite_artists) as unknown;
        if (Array.isArray(parsed)) {
          mergedNames = [...new Set([...parsed.map((x) => String(x)), ...normalized])];
        }
      } catch {
        /* keep normalized only */
      }
    }

    const favoritesJson = JSON.stringify(mergedNames);
    if (profile) {
      await c.env.DB
        .prepare(
          `UPDATE user_profiles
         SET favorite_artists = ?, updated_at = CURRENT_TIMESTAMP
         WHERE mocha_user_id = ?`,
        )
        .bind(favoritesJson, uid)
        .run();
    } else {
      await c.env.DB
        .prepare(
          `INSERT INTO user_profiles (mocha_user_id, role, favorite_artists, created_at, updated_at)
           VALUES (?, 'fan', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        )
        .bind(uid, favoritesJson)
        .run();
    }

    return c.json({ success: true, synced: normalized.length });
  } catch (error) {
    console.error('syncFavoriteArtistsByName error:', error);
    return c.json({ error: 'Failed to sync favorite artists' }, 500);
  }
}
