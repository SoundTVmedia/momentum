import { Context } from 'hono';

/**
 * Gamification System Endpoints
 * Points, badges, and leaderboards
 */

// Award points for various actions
export async function awardPoints(
  env: Env,
  userId: string,
  points: number,
  reason: string,
  relatedClipId?: number,
  relatedCommentId?: number
): Promise<void> {
  // Initialize user points if doesn't exist
  await env.DB.prepare(
    `INSERT INTO user_points (mocha_user_id, points, created_at, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(mocha_user_id) DO NOTHING`
  )
    .bind(userId, 0)
    .run();

  // Add points transaction
  await env.DB.prepare(
    `INSERT INTO point_transactions (mocha_user_id, points_amount, reason, related_clip_id, related_comment_id, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(userId, points, reason, relatedClipId || null, relatedCommentId || null)
    .run();

  // Update total points
  await env.DB.prepare(
    `UPDATE user_points 
     SET points = points + ?, updated_at = CURRENT_TIMESTAMP
     WHERE mocha_user_id = ?`
  )
    .bind(points, userId)
    .run();

  // Check level up
  const userPoints = await env.DB.prepare(
    `SELECT points FROM user_points WHERE mocha_user_id = ?`
  )
    .bind(userId)
    .first() as { points: number } | null;

  if (userPoints) {
    const newLevel = calculateLevel(userPoints.points);
    await env.DB.prepare(
      `UPDATE user_points SET level = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?`
    )
      .bind(newLevel, userId)
      .run();
  }

  // Check for new badges
  await checkAndAwardBadges(env, userId);
}

// Calculate level based on points
function calculateLevel(points: number): number {
  // Simple progression: 100 points per level
  return Math.floor(points / 100) + 1;
}

// Check and award badges based on user activity
async function checkAndAwardBadges(env: Env, userId: string): Promise<void> {
  // Get user stats
  const userStats = await getUserStats(env, userId);
  
  // Check each badge criteria
  const badges = await env.DB.prepare(`SELECT * FROM badges`).all();
  
  for (const badge of badges.results || []) {
    const alreadyHas = await env.DB.prepare(
      `SELECT id FROM user_badges WHERE mocha_user_id = ? AND badge_id = ?`
    )
      .bind(userId, badge.id)
      .first();

    if (alreadyHas) continue;

    let shouldAward = false;

    // Check criteria based on badge type
    const requiredPoints = typeof badge.points_required === 'number' ? badge.points_required : 0;
    
    switch (badge.badge_type) {
      case 'uploads':
        shouldAward = userStats.totalClips >= requiredPoints;
        break;
      case 'likes':
        shouldAward = userStats.totalLikes >= requiredPoints;
        break;
      case 'points':
        shouldAward = userStats.points >= requiredPoints;
        break;
      case 'featured':
        shouldAward = userStats.featuredClips >= requiredPoints;
        break;
    }

    if (shouldAward) {
      await env.DB.prepare(
        `INSERT INTO user_badges (mocha_user_id, badge_id, earned_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`
      )
        .bind(userId, badge.id)
        .run();

      // Create notification
      await env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'achievement', ?, CURRENT_TIMESTAMP)`
      )
        .bind(userId, `You earned the "${badge.name}" badge! 🏆`)
        .run();
    }
  }
}

// Get user stats for badge checking
async function getUserStats(env: Env, userId: string) {
  const clips = await env.DB.prepare(
    `SELECT COUNT(*) as count, SUM(likes_count) as likes FROM clips WHERE mocha_user_id = ?`
  )
    .bind(userId)
    .first() as { count: number; likes: number } | null;

  const featured = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM live_featured_clips lfc
     JOIN clips c ON lfc.clip_id = c.id
     WHERE c.mocha_user_id = ?`
  )
    .bind(userId)
    .first() as { count: number } | null;

  const points = await env.DB.prepare(
    `SELECT points FROM user_points WHERE mocha_user_id = ?`
  )
    .bind(userId)
    .first() as { points: number } | null;

  return {
    totalClips: clips?.count || 0,
    totalLikes: clips?.likes || 0,
    featuredClips: featured?.count || 0,
    points: points?.points || 0,
  };
}

// Get user points and level
export async function getUserPoints(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userPoints = await c.env.DB.prepare(
    `SELECT points, level FROM user_points WHERE mocha_user_id = ?`
  )
    .bind(mochaUser.id)
    .first();

  if (!userPoints) {
    // Initialize if doesn't exist
    await c.env.DB.prepare(
      `INSERT INTO user_points (mocha_user_id, points, level, created_at, updated_at)
       VALUES (?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(mochaUser.id)
      .run();

    return c.json({ points: 0, level: 1 });
  }

  return c.json(userPoints);
}

// Get user badges
export async function getUserBadges(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const badges = await c.env.DB.prepare(
    `SELECT 
      badges.*,
      user_badges.earned_at
    FROM user_badges
    JOIN badges ON user_badges.badge_id = badges.id
    WHERE user_badges.mocha_user_id = ?
    ORDER BY user_badges.earned_at DESC`
  )
    .bind(mochaUser.id)
    .all();

  return c.json({ badges: badges.results || [] });
}

// Get leaderboard
export async function getLeaderboard(c: Context) {
  const timeframe = c.req.query('timeframe') || 'all_time'; // all_time, weekly, monthly
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  let query = `
    SELECT 
      user_points.mocha_user_id,
      user_points.points,
      user_points.level,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(DISTINCT user_badges.badge_id) as badge_count
    FROM user_points
    LEFT JOIN user_profiles ON user_points.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN user_badges ON user_points.mocha_user_id = user_badges.mocha_user_id
  `;

  if (timeframe === 'weekly') {
    query = `
      SELECT 
        point_transactions.mocha_user_id,
        SUM(point_transactions.points_amount) as points,
        user_points.level,
        user_profiles.display_name,
        user_profiles.profile_image_url,
        COUNT(DISTINCT user_badges.badge_id) as badge_count
      FROM point_transactions
      LEFT JOIN user_points ON point_transactions.mocha_user_id = user_points.mocha_user_id
      LEFT JOIN user_profiles ON point_transactions.mocha_user_id = user_profiles.mocha_user_id
      LEFT JOIN user_badges ON point_transactions.mocha_user_id = user_badges.mocha_user_id
      WHERE point_transactions.created_at >= datetime('now', '-7 days')
    `;
  } else if (timeframe === 'monthly') {
    query = `
      SELECT 
        point_transactions.mocha_user_id,
        SUM(point_transactions.points_amount) as points,
        user_points.level,
        user_profiles.display_name,
        user_profiles.profile_image_url,
        COUNT(DISTINCT user_badges.badge_id) as badge_count
      FROM point_transactions
      LEFT JOIN user_points ON point_transactions.mocha_user_id = user_points.mocha_user_id
      LEFT JOIN user_profiles ON point_transactions.mocha_user_id = user_profiles.mocha_user_id
      LEFT JOIN user_badges ON point_transactions.mocha_user_id = user_badges.mocha_user_id
      WHERE point_transactions.created_at >= datetime('now', '-30 days')
    `;
  }

  query += `
    GROUP BY ${timeframe === 'all_time' ? 'user_points.mocha_user_id' : 'point_transactions.mocha_user_id'}
    ORDER BY points DESC
    LIMIT ?
  `;

  const leaderboard = await c.env.DB.prepare(query)
    .bind(limit)
    .all();

  return c.json({ leaderboard: leaderboard.results || [] });
}

// Initialize default badges
export async function initializeDefaultBadges(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const defaultBadges = [
    {
      name: 'First Upload',
      description: 'Shared your first concert moment',
      badge_type: 'uploads',
      points_required: 1,
    },
    {
      name: 'Rising Star',
      description: 'Uploaded 10 concert clips',
      badge_type: 'uploads',
      points_required: 10,
    },
    {
      name: 'Content Creator',
      description: 'Uploaded 50 concert clips',
      badge_type: 'uploads',
      points_required: 50,
    },
    {
      name: 'Community Favorite',
      description: 'Received 100 likes across all clips',
      badge_type: 'likes',
      points_required: 100,
    },
    {
      name: 'Crowd Pleaser',
      description: 'Received 1000 likes across all clips',
      badge_type: 'likes',
      points_required: 1000,
    },
    {
      name: 'MOMENTUM Legend',
      description: 'Reached level 10',
      badge_type: 'points',
      points_required: 1000,
    },
    {
      name: 'Featured Creator',
      description: 'Had a clip featured on MOMENTUM Live',
      badge_type: 'featured',
      points_required: 1,
    },
  ];

  for (const badge of defaultBadges) {
    await c.env.DB.prepare(
      `INSERT INTO badges (name, description, badge_type, points_required, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(name) DO NOTHING`
    )
      .bind(badge.name, badge.description, badge.badge_type, badge.points_required)
      .run();
  }

  return c.json({ success: true, message: 'Default badges initialized' });
}
