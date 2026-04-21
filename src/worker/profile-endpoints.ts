import { Context } from 'hono';

/**
 * Get user profile stats including lifetime metrics
 */
export async function getUserStats(c: Context) {
  const userId = c.req.param('userId');

  try {
    // Get all clips by user
    const clips = await c.env.DB.prepare(
      'SELECT id, views_count, average_rating FROM clips WHERE mocha_user_id = ? AND is_hidden = 0'
    )
      .bind(userId)
      .all();

    const clipsArray = clips.results || [];
    
    // Calculate stats
    const totalClipsPosted = clipsArray.length;
    const totalViewsOnClips = clipsArray.reduce((sum: number, clip: any) => sum + (clip.views_count || 0), 0);
    
    // Calculate average rating (average of all clip ratings)
    const clipsWithRatings = clipsArray.filter((clip: any) => clip.average_rating && clip.average_rating > 0);
    const userAverageClipRating = clipsWithRatings.length > 0
      ? clipsWithRatings.reduce((sum: number, clip: any) => sum + (clip.average_rating || 0), 0) / clipsWithRatings.length
      : 0;

    return c.json({
      totalClipsPosted,
      totalViewsOnClips,
      userAverageClipRating: Number(userAverageClipRating.toFixed(2))
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return c.json({ error: 'Failed to get user stats' }, 500);
  }
}

/**
 * Get user's favorite artists with clips
 */
export async function getUserFavoriteArtistsWithClips(c: Context) {
  const userId = c.req.param('userId');

  try {
    // Get favorite artists
    const artists = await c.env.DB.prepare(
      `SELECT 
        user_favorite_artists.artist_id,
        artists.name,
        artists.image_url,
        artists.bio
      FROM user_favorite_artists
      LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
      WHERE user_favorite_artists.mocha_user_id = ?
      ORDER BY user_favorite_artists.created_at DESC`
    )
      .bind(userId)
      .all();

    const artistsWithClips = [];

    // For each artist, get favorited clips
    for (const artist of (artists.results || [])) {
      const clips = await c.env.DB.prepare(
        `SELECT 
          clips.*,
          user_profiles.display_name as user_display_name,
          user_profiles.profile_image_url as user_avatar
        FROM user_favorite_clips_by_artist
        LEFT JOIN clips ON user_favorite_clips_by_artist.clip_id = clips.id
        LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
        WHERE user_favorite_clips_by_artist.mocha_user_id = ?
        AND user_favorite_clips_by_artist.artist_id = ?
        ORDER BY user_favorite_clips_by_artist.created_at DESC
        LIMIT 20`
      )
        .bind(userId, (artist as any).artist_id)
        .all();

      artistsWithClips.push({
        artist,
        clips: clips.results || []
      });
    }

    return c.json({ favoriteArtists: artistsWithClips });
  } catch (error) {
    console.error('Get favorite artists with clips error:', error);
    return c.json({ error: 'Failed to get favorite artists with clips' }, 500);
  }
}
