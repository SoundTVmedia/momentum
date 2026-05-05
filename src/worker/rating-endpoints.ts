import { Context } from 'hono';

/**
 * Rate a clip (1-5 stars)
 */
export async function rateClip(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const clipId = c.req.param('id');
  const body = await c.req.json();
  const { rating } = body;

  if (!clipId) {
    return c.json({ error: 'Clip id is required' }, 400);
  }

  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: 'Rating must be between 1 and 5' }, 400);
  }

  try {
    // Check if clip exists
    const clip = await c.env.DB.prepare(
      'SELECT id, mocha_user_id FROM clips WHERE id = ?'
    )
      .bind(clipId)
      .first();

    if (!clip) {
      return c.json({ error: 'Clip not found' }, 404);
    }

    // Check if user already rated this clip
    const existingRating = await c.env.DB.prepare(
      'SELECT rating FROM clip_ratings WHERE clip_id = ? AND mocha_user_id = ?'
    )
      .bind(clipId, mochaUser.id)
      .first();

    if (existingRating) {
      // Update existing rating
      await c.env.DB.prepare(
        'UPDATE clip_ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE clip_id = ? AND mocha_user_id = ?'
      )
        .bind(rating, clipId, mochaUser.id)
        .run();
    } else {
      // Insert new rating
      await c.env.DB.prepare(
        'INSERT INTO clip_ratings (clip_id, mocha_user_id, rating, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
      )
        .bind(clipId, mochaUser.id, rating)
        .run();
    }

    // Recalculate average rating for the clip
    const ratingStats = await c.env.DB.prepare(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM clip_ratings WHERE clip_id = ?'
    )
      .bind(clipId)
      .first() as { avg_rating: number; rating_count: number } | null;

    if (ratingStats) {
      await c.env.DB.prepare(
        'UPDATE clips SET average_rating = ?, rating_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
        .bind(ratingStats.avg_rating || 0, ratingStats.rating_count || 0, clipId)
        .run();
    }

    // Award points for rating (only on first rating)
    if (!existingRating) {
      const { awardPoints } = await import('./gamification-endpoints');
      await awardPoints(c.env, mochaUser.id, 2, 'Rated a clip', parseInt(clipId, 10));
    }

    return c.json({ 
      success: true, 
      rated: true,
      newRating: rating,
      averageRating: ratingStats?.avg_rating || 0,
      ratingCount: ratingStats?.rating_count || 0
    });
  } catch (error) {
    console.error('Rating error:', error);
    return c.json({ error: 'Failed to rate clip' }, 500);
  }
}

/**
 * Get user's rating for a clip
 */
export async function getUserClipRating(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ rating: null });
  }

  const clipId = c.req.param('id');

  try {
    const rating = await c.env.DB.prepare(
      'SELECT rating FROM clip_ratings WHERE clip_id = ? AND mocha_user_id = ?'
    )
      .bind(clipId, mochaUser.id)
      .first() as { rating: number } | null;

    return c.json({ rating: rating?.rating || null });
  } catch (error) {
    console.error('Get rating error:', error);
    return c.json({ rating: null });
  }
}
