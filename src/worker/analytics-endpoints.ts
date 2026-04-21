import { Context } from 'hono';

/**
 * Track daily active user
 */
async function trackDailyActiveUser(db: Env['DB'], userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  await db.prepare(
    `INSERT OR IGNORE INTO daily_active_users (mocha_user_id, activity_date, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(userId, today)
    .run();
}

/**
 * Get platform-wide analytics
 */
export async function getPlatformAnalytics(c: Context) {
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

  const range = c.req.query('range') || '30d';
  let daysBack = 30;
  
  switch (range) {
    case '7d':
      daysBack = 7;
      break;
    case '90d':
      daysBack = 90;
      break;
    default:
      daysBack = 30;
  }

  // Platform Stats
  const totalUsers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM user_profiles"
  ).first() as { count: number } | null;

  const totalClips = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM clips WHERE is_hidden = 0"
  ).first() as { count: number } | null;

  const totalViewsLikes = await c.env.DB.prepare(
    "SELECT SUM(views_count) as views, SUM(likes_count) as likes FROM clips WHERE is_hidden = 0"
  ).first() as { views: number; likes: number } | null;

  const activeSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions WHERE status = 'live'"
  ).first() as { count: number } | null;

  const totalSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions"
  ).first() as { count: number } | null;

  // Daily/Weekly/Monthly Active Users
  const dailyActiveUsers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT mocha_user_id) as count FROM daily_active_users WHERE activity_date = date('now')"
  ).first() as { count: number } | null;

  const weeklyActiveUsers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT mocha_user_id) as count FROM daily_active_users WHERE activity_date >= date('now', '-7 days')"
  ).first() as { count: number } | null;

  const monthlyActiveUsers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT mocha_user_id) as count FROM daily_active_users WHERE activity_date >= date('now', '-30 days')"
  ).first() as { count: number } | null;

  // Video uploads per day (for selected range)
  const uploadsPerDay = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      COUNT(*) as uploads
    FROM clips
    WHERE created_at >= date('now', '-' || ? || ' days')
    AND is_hidden = 0
    GROUP BY date(created_at)
    ORDER BY date DESC`
  )
    .bind(daysBack)
    .all();

  // Engagement metrics
  const engagementMetrics = await c.env.DB.prepare(
    `SELECT 
      SUM(likes_count) as total_likes,
      SUM(comments_count) as total_comments,
      SUM(views_count) as total_views,
      COUNT(*) as total_clips,
      AVG(likes_count) as avg_likes_per_clip,
      AVG(comments_count) as avg_comments_per_clip,
      AVG(views_count) as avg_views_per_clip
    FROM clips
    WHERE created_at >= date('now', '-' || ? || ' days')
    AND is_hidden = 0`
  )
    .bind(daysBack)
    .first();

  // Growth Data - daily stats
  const growthData = await c.env.DB.prepare(
    `WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-' || ? || ' days')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    )
    SELECT 
      dates.date,
      COALESCE(COUNT(DISTINCT user_profiles.id), 0) as users,
      COALESCE(COUNT(DISTINCT clips.id), 0) as clips,
      COALESCE(SUM(clips.views_count), 0) as views,
      COALESCE(COUNT(DISTINCT dau.mocha_user_id), 0) as active_users
    FROM dates
    LEFT JOIN user_profiles ON date(user_profiles.created_at) = dates.date
    LEFT JOIN clips ON date(clips.created_at) = dates.date AND clips.is_hidden = 0
    LEFT JOIN daily_active_users dau ON dau.activity_date = dates.date
    GROUP BY dates.date
    ORDER BY dates.date ASC`
  )
    .bind(daysBack)
    .all();

  // Top Clips by engagement
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as engagement_score,
      ROUND(CAST(clips.likes_count + clips.comments_count AS REAL) / NULLIF(clips.views_count, 0) * 100, 2) as engagement_rate
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    ORDER BY engagement_score DESC
    LIMIT 10`
  )
    .bind(daysBack)
    .all();

  // Top Users by contribution
  const topUsers = await c.env.DB.prepare(
    `SELECT 
      user_profiles.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(clips.id) as total_clips,
      SUM(clips.likes_count) as total_likes,
      SUM(clips.views_count) as total_views,
      SUM(clips.comments_count) as total_comments
    FROM user_profiles
    JOIN clips ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    GROUP BY user_profiles.mocha_user_id
    ORDER BY total_clips DESC, total_likes DESC
    LIMIT 10`
  )
    .bind(daysBack)
    .all();

  return c.json({
    platformStats: {
      totalUsers: totalUsers?.count || 0,
      totalClips: totalClips?.count || 0,
      totalViews: totalViewsLikes?.views || 0,
      totalLikes: totalViewsLikes?.likes || 0,
      activeSessions: activeSessions?.count || 0,
      totalSessions: totalSessions?.count || 0,
      dailyActiveUsers: dailyActiveUsers?.count || 0,
      weeklyActiveUsers: weeklyActiveUsers?.count || 0,
      monthlyActiveUsers: monthlyActiveUsers?.count || 0,
    },
    uploadsPerDay: uploadsPerDay.results || [],
    engagementMetrics: engagementMetrics || {},
    growthData: growthData.results || [],
    topClips: topClips.results || [],
    topUsers: topUsers.results || [],
  });
}

/**
 * Get user-level analytics
 */
export async function getUserAnalytics(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Track this user as active
  await trackDailyActiveUser(c.env.DB, mochaUser.id);

  const userId = c.req.query('user_id') || mochaUser.id;

  // Only allow users to view their own analytics unless they're admin
  if (userId !== mochaUser.id) {
    const userProfile = await c.env.DB.prepare(
      "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    if (!userProfile || !userProfile.is_admin) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  // Get follower and following counts
  const followerCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE following_id = ?"
  )
    .bind(userId)
    .first() as { count: number } | null;

  const followingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE follower_id = ?"
  )
    .bind(userId)
    .first() as { count: number } | null;

  // Get profile views (last 30 days)
  const profileViews = await c.env.DB.prepare(
    `SELECT COUNT(*) as count 
     FROM profile_views 
     WHERE profile_user_id = ? 
     AND created_at >= date('now', '-30 days')`
  )
    .bind(userId)
    .first() as { count: number } | null;

  // Get clip statistics
  const clipStats = await c.env.DB.prepare(
    `SELECT 
      COUNT(*) as total_clips,
      SUM(likes_count) as total_likes,
      SUM(views_count) as total_views,
      SUM(comments_count) as total_comments,
      AVG(likes_count) as avg_likes,
      AVG(views_count) as avg_views,
      AVG(comments_count) as avg_comments
    FROM clips
    WHERE mocha_user_id = ?
    AND is_hidden = 0`
  )
    .bind(userId)
    .first();

  // Get saved clips count
  const savedClipsCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM saved_clips WHERE mocha_user_id = ?"
  )
    .bind(userId)
    .first() as { count: number } | null;

  // Get recent engagement over time (last 30 days)
  const engagementOverTime = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      SUM(likes_count) as likes,
      SUM(views_count) as views,
      SUM(comments_count) as comments
    FROM clips
    WHERE mocha_user_id = ?
    AND created_at >= date('now', '-30 days')
    AND is_hidden = 0
    GROUP BY date(created_at)
    ORDER BY date ASC`
  )
    .bind(userId)
    .all();

  // Top performing clips
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as engagement_score
    FROM clips
    WHERE clips.mocha_user_id = ?
    AND clips.is_hidden = 0
    ORDER BY engagement_score DESC
    LIMIT 5`
  )
    .bind(userId)
    .all();

  return c.json({
    followers: followerCount?.count || 0,
    following: followingCount?.count || 0,
    profileViews: profileViews?.count || 0,
    savedClips: savedClipsCount?.count || 0,
    clipStats: clipStats || {},
    engagementOverTime: engagementOverTime.results || [],
    topClips: topClips.results || [],
  });
}

/**
 * Get ambassador-level analytics
 */
export async function getAmbassadorAnalytics(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is ambassador
  const userProfile = await c.env.DB.prepare(
    "SELECT role, commission_rate, earnings_balance FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || userProfile.role !== 'ambassador') {
    return c.json({ error: "Ambassador access required" }, 403);
  }

  // Commission earnings
  const totalEarnings = await c.env.DB.prepare(
    "SELECT SUM(commission_amount) as total FROM affiliate_sales WHERE referrer_user_id = ?"
  )
    .bind(mochaUser.id)
    .first() as { total: number } | null;

  const monthlyEarnings = await c.env.DB.prepare(
    `SELECT SUM(commission_amount) as total 
     FROM affiliate_sales 
     WHERE referrer_user_id = ? 
     AND created_at >= date('now', '-30 days')`
  )
    .bind(mochaUser.id)
    .first() as { total: number } | null;

  // Earnings over time (last 90 days)
  const earningsOverTime = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      SUM(commission_amount) as earnings,
      COUNT(*) as sales
    FROM affiliate_sales
    WHERE referrer_user_id = ?
    AND created_at >= date('now', '-90 days')
    GROUP BY date(created_at)
    ORDER BY date ASC`
  )
    .bind(mochaUser.id)
    .all();

  // Top performing clips (by referrals/sales)
  const topPerformingClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      COUNT(affiliate_sales.id) as total_sales,
      SUM(affiliate_sales.commission_amount) as total_commission
    FROM clips
    LEFT JOIN affiliate_sales ON affiliate_sales.referrer_user_id = clips.mocha_user_id
    WHERE clips.mocha_user_id = ?
    AND clips.is_hidden = 0
    GROUP BY clips.id
    ORDER BY total_sales DESC, total_commission DESC
    LIMIT 10`
  )
    .bind(mochaUser.id)
    .all();

  // Referral conversions
  const conversionStats = await c.env.DB.prepare(
    `SELECT 
      COUNT(DISTINCT clips.id) as total_clips,
      COUNT(DISTINCT affiliate_sales.id) as total_conversions,
      ROUND(CAST(COUNT(DISTINCT affiliate_sales.id) AS REAL) / NULLIF(COUNT(DISTINCT clips.id), 0) * 100, 2) as conversion_rate
    FROM clips
    LEFT JOIN affiliate_sales ON affiliate_sales.referrer_user_id = clips.mocha_user_id
    WHERE clips.mocha_user_id = ?
    AND clips.is_hidden = 0`
  )
    .bind(mochaUser.id)
    .first();

  // Recent sales
  const recentSales = await c.env.DB.prepare(
    `SELECT * FROM affiliate_sales 
     WHERE referrer_user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 20`
  )
    .bind(mochaUser.id)
    .all();

  return c.json({
    totalEarnings: (totalEarnings?.total || 0) / 100, // Convert to dollars
    monthlyEarnings: (monthlyEarnings?.total || 0) / 100,
    earningsBalance: ((userProfile.earnings_balance as number) || 0) / 100,
    commissionRate: userProfile.commission_rate || 0.05,
    earningsOverTime: earningsOverTime.results || [],
    topPerformingClips: topPerformingClips.results || [],
    conversionStats: conversionStats || {},
    recentSales: recentSales.results || [],
  });
}

/**
 * Get trend analysis
 */
export async function getTrendAnalysis(c: Context) {
  const range = c.req.query('range') || 'week';
  let daysBack = 7;
  
  switch (range) {
    case 'day':
      daysBack = 1;
      break;
    case 'week':
      daysBack = 7;
      break;
    case 'month':
      daysBack = 30;
      break;
    default:
      daysBack = 7;
  }

  // Top artists
  const topArtists = await c.env.DB.prepare(
    `SELECT 
      clips.artist_name,
      artists.image_url,
      COUNT(DISTINCT clips.id) as clip_count,
      SUM(clips.views_count) as total_views,
      SUM(clips.likes_count) as total_likes,
      (SUM(clips.likes_count) * 3 + SUM(clips.views_count) * 0.1 + SUM(clips.comments_count) * 5) as engagement_score
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    GROUP BY clips.artist_name
    ORDER BY engagement_score DESC
    LIMIT 20`
  )
    .bind(daysBack)
    .all();

  // Top venues
  const topVenues = await c.env.DB.prepare(
    `SELECT 
      clips.venue_name,
      venues.location,
      venues.image_url,
      COUNT(DISTINCT clips.id) as clip_count,
      SUM(clips.views_count) as total_views,
      SUM(clips.likes_count) as total_likes,
      (SUM(clips.likes_count) * 3 + SUM(clips.views_count) * 0.1 + SUM(clips.comments_count) * 5) as engagement_score
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    GROUP BY clips.venue_name
    ORDER BY engagement_score DESC
    LIMIT 20`
  )
    .bind(daysBack)
    .all();

  // Top clips
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as engagement_score
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    ORDER BY engagement_score DESC
    LIMIT 20`
  )
    .bind(daysBack)
    .all();

  // Trending hashtags
  const trendingHashtags = await c.env.DB.prepare(
    `SELECT 
      hashtag,
      COUNT(*) as usage_count
    FROM (
      SELECT 
        json_each.value as hashtag
      FROM clips,
      json_each(clips.hashtags)
      WHERE clips.created_at >= date('now', '-' || ? || ' days')
      AND clips.is_hidden = 0
      AND clips.hashtags IS NOT NULL
    )
    GROUP BY hashtag
    ORDER BY usage_count DESC
    LIMIT 20`
  )
    .bind(daysBack)
    .all();

  return c.json({
    range,
    topArtists: topArtists.results || [],
    topVenues: topVenues.results || [],
    topClips: topClips.results || [],
    trendingHashtags: trendingHashtags.results || [],
  });
}

/**
 * Track profile view
 */
export async function trackProfileView(c: Context) {
  const profileUserId = c.req.param('userId');
  const mochaUser = c.get("user");
  
  // Don't track if viewing own profile
  if (mochaUser && profileUserId === mochaUser.id) {
    return c.json({ success: true });
  }

  // Track the view
  await c.env.DB.prepare(
    `INSERT INTO profile_views (profile_user_id, viewer_user_id, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(profileUserId, mochaUser?.id || null)
    .run();

  return c.json({ success: true });
}

/**
 * Track clip share
 */
export async function trackClipShare(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { clip_id, platform } = body;

  if (!clip_id) {
    return c.json({ error: "clip_id is required" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO clip_shares (clip_id, shared_by, platform, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(clip_id, mochaUser.id, platform || null)
    .run();

  return c.json({ success: true });
}

/**
 * Get clip-level analytics
 */
export async function getClipAnalytics(c: Context) {
  const clipId = c.req.param('clipId');
  const mochaUser = c.get("user");

  // Get clip and verify ownership or admin
  const clip = await c.env.DB.prepare(
    "SELECT mocha_user_id FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Only owner or admin can view analytics
  if (mochaUser && clip.mocha_user_id !== mochaUser.id) {
    const userProfile = await c.env.DB.prepare(
      "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    if (!userProfile || !userProfile.is_admin) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  // Get clip stats
  const clipStats = await c.env.DB.prepare(
    "SELECT * FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  // Get share count
  const shareCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM clip_shares WHERE clip_id = ?"
  )
    .bind(clipId)
    .first() as { count: number } | null;

  // Get save count
  const saveCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM saved_clips WHERE clip_id = ?"
  )
    .bind(clipId)
    .first() as { count: number } | null;

  // Calculate engagement rate
  const engagementRate = clipStats && clipStats.views_count 
    ? ((clipStats.likes_count as number + clipStats.comments_count as number) / clipStats.views_count as number * 100).toFixed(2)
    : 0;

  // Views over time (last 30 days)
  const viewsOverTime = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      COUNT(*) as views
    FROM profile_views
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date ASC`
  )
    .all();

  return c.json({
    views: clipStats?.views_count || 0,
    likes: clipStats?.likes_count || 0,
    comments: clipStats?.comments_count || 0,
    shares: shareCount?.count || 0,
    saves: saveCount?.count || 0,
    engagementRate: parseFloat(engagementRate as string),
    viewsOverTime: viewsOverTime.results || [],
  });
}
