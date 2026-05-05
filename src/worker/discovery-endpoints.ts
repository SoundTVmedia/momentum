import { Context } from 'hono';
import { jamBaseFetch } from './jambase-client';
import { buildTightJamBaseEventResults } from './jambase-events-search';

// Advanced search with filters
export async function advancedSearch(c: Context) {
  const query = c.req.query('q') || '';
  const location = c.req.query('location') || '';
  const dateRange = c.req.query('dateRange') || '30d';
  const sortBy = c.req.query('sortBy') || 'latest';
  const compact = c.req.query('compact') === '1';
  const clipLimit = compact ? 8 : 30;
  const artistLimit = compact ? 6 : 20;
  const venueLimit = compact ? 6 : 20;
  const userLimit = compact ? 4 : 20;
  
  if (!query.trim()) {
    return c.json({
      clips: [],
      artists: [],
      venues: [],
      users: [],
      jambase: { artists: [], venues: [], events: [] },
    });
  }

  let daysBack = 30;
  switch (dateRange) {
    case '7d': daysBack = 7; break;
    case '90d': daysBack = 90; break;
    case 'all': daysBack = 36500; break; // ~100 years
    default: daysBack = 30;
  }

  // Search clips
  let clipsQuery = `
    SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND clips.created_at >= date('now', '-' || ? || ' days')
    AND (
      clips.artist_name LIKE ? OR
      clips.venue_name LIKE ? OR
      clips.location LIKE ? OR
      clips.content_description LIKE ?
    )
  `;

  const bindings: any[] = [daysBack, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

  if (location) {
    clipsQuery += ` AND clips.location LIKE ?`;
    bindings.push(`%${location}%`);
  }

  // Apply sorting
  switch (sortBy) {
    case 'trending':
      clipsQuery += ` ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC`;
      break;
    case 'most_liked':
      clipsQuery += ` ORDER BY clips.likes_count DESC`;
      break;
    case 'most_viewed':
      clipsQuery += ` ORDER BY clips.views_count DESC`;
      break;
    default:
      clipsQuery += ` ORDER BY clips.created_at DESC`;
  }

  clipsQuery += ` LIMIT ${clipLimit}`;

  const clips = await c.env.DB.prepare(clipsQuery).bind(...bindings).all();

  // Search artists
  const artists = await c.env.DB.prepare(
    `SELECT 
      clips.artist_name as name,
      artists.image_url,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.artist_name LIKE ?
    AND clips.is_hidden = 0
    GROUP BY clips.artist_name
    ORDER BY clip_count DESC
    LIMIT ${artistLimit}`
  )
    .bind(`%${query}%`)
    .all();

  // Search venues
  const venues = await c.env.DB.prepare(
    `SELECT 
      clips.venue_name as name,
      venues.location,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.venue_name LIKE ?
    AND clips.is_hidden = 0
    GROUP BY clips.venue_name
    ORDER BY clip_count DESC
    LIMIT ${venueLimit}`
  )
    .bind(`%${query}%`)
    .all();

  // Search users
  const users = await c.env.DB.prepare(
    `SELECT 
      user_profiles.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(DISTINCT clips.id) as clip_count
    FROM user_profiles
    LEFT JOIN clips ON user_profiles.mocha_user_id = clips.mocha_user_id AND clips.is_hidden = 0
    WHERE user_profiles.display_name LIKE ?
    GROUP BY user_profiles.mocha_user_id
    HAVING clip_count > 0
    ORDER BY clip_count DESC
    LIMIT ${userLimit}`
  )
    .bind(`%${query}%`)
    .all();

  let jambase: { artists: unknown[]; venues: unknown[]; events: unknown[] } = {
    artists: [],
    venues: [],
    events: [],
  };

  const jbKey = c.env.JAMBASE_API_KEY;
  if (query.trim().length >= 2 && typeof jbKey === 'string' && jbKey.trim()) {
    const q = query.trim();
    const jbPer = compact ? '5' : '10';
    const eventCap = compact ? 8 : 18;
    const [a, v, tightEvents] = await Promise.all([
      jamBaseFetch<{ artists?: unknown[] }>(jbKey, '/artists', {
        artistName: q,
        perPage: jbPer,
        page: '1',
      }),
      jamBaseFetch<{ venues?: unknown[] }>(jbKey, '/venues', {
        venueName: q,
        perPage: jbPer,
        page: '1',
      }),
      buildTightJamBaseEventResults(jbKey, q, eventCap),
    ]);
    jambase = {
      artists: a?.artists ?? [],
      venues: v?.venues ?? [],
      events: tightEvents,
    };
  }

  return c.json({
    clips: clips.results || [],
    artists: artists.results || [],
    venues: venues.results || [],
    users: users.results || [],
    jambase,
  });
}

// Get trending content
export async function getTrendingContent(c: Context) {
  // Trending clips - last 7 days, sorted by engagement
  const trendingClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC
    LIMIT 12`
  ).all();

  // Trending artists - most clips in last 7 days
  const trendingArtists = await c.env.DB.prepare(
    `SELECT 
      clips.artist_name as name,
      artists.image_url,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    GROUP BY clips.artist_name
    ORDER BY clip_count DESC
    LIMIT 12`
  ).all();

  // Trending venues - most clips in last 7 days
  const trendingVenues = await c.env.DB.prepare(
    `SELECT 
      clips.venue_name as name,
      venues.location,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    GROUP BY clips.venue_name
    ORDER BY clip_count DESC
    LIMIT 9`
  ).all();

  return c.json({
    clips: trendingClips.results || [],
    artists: trendingArtists.results || [],
    venues: trendingVenues.results || [],
  });
}
