import { Context } from 'hono';
import type { MochaUser } from '@/shared/mocha-user';
import {
  jamBaseFetch,
  jamBaseMissingKeyNotice,
  jamBaseApiKeyConfigured,
  jamBaseQuotaFromEnv,
} from './jambase-client';
import { cacheJsonProxy } from './performance-utils';
import {
  buildTightJamBaseEventResults,
  jamBaseArtistVenueSearchPhrase,
} from './jambase-events-search';
import { resolveDiscoverLocation } from './discover-location';
import { buildDiscoverForYou } from './discover-for-you';
import {
  enrichSearchArtistsWithJamBase,
  enrichSearchVenuesWithJamBase,
  enrichTrendingArtistsWithJamBase,
  fetchNearbyJamBaseEvents,
  type SearchVenueRow,
  type TrendingArtistRow,
} from './discover-jambase-enrich';

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
    cacheJsonProxy(c, { browserMaxAge: 30, cdnMaxAge: 120 });
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
      clips.content_description LIKE ? OR
      clips.hashtags LIKE ?
    )
  `;

  const q = `%${query}%`;
  const bindings: any[] = [daysBack, q, q, q, q, q];

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
      MAX(artists.image_url) as image_url,
      MAX(clips.jambase_artist_id) as jambase_id,
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
      MAX(venues.location) as location,
      MAX(venues.image_url) as image_url,
      MAX(clips.jambase_venue_id) as jambase_id,
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
  let jambaseNotice: string | null = null;

  const jbKey = c.env.JAMBASE_API_KEY;
  if (query.trim().length >= 2 && typeof jbKey === 'string' && jbKey.trim()) {
    const q = query.trim();
    const jbPer = compact ? '5' : '10';
    const eventCap = compact ? 8 : 18;
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const phrase = jamBaseArtistVenueSearchPhrase(q);
    const [a, v] = await Promise.all([
      jamBaseFetch<{ artists?: unknown[] }>(
        jbKey,
        '/artists',
        {
          artistName: phrase,
          perPage: jbPer,
          page: '1',
        },
        jbQ
      ),
      jamBaseFetch<{ venues?: unknown[] }>(
        jbKey,
        '/venues',
        {
          venueName: phrase,
          perPage: jbPer,
          page: '1',
        },
        jbQ
      ),
    ]);
    const tightEvents = await buildTightJamBaseEventResults(jbKey, q, eventCap, jbQ, {
      artistList: a as { artists?: Record<string, unknown>[] } | null,
      venueList: v as { venues?: Record<string, unknown>[] } | null,
    });
    jambase = {
      artists: a?.artists ?? [],
      venues: v?.venues ?? [],
      events: tightEvents,
    };
    if (a == null && v == null) {
      jambaseNotice =
        'JamBase artist/venue search did not complete (network error, invalid API key, or JAMBASE_QUOTA_ENFORCEMENT may have blocked upstream calls). Your Feedback clips and on-platform matches below are unchanged — check worker logs.';
    }
  } else if (query.trim().length >= 2 && !jamBaseApiKeyConfigured(jbKey)) {
    jambaseNotice = jamBaseMissingKeyNotice();
  }

  const artistsBase = (artists.results ?? []) as TrendingArtistRow[];
  const venuesBase = (venues.results ?? []) as SearchVenueRow[];
  const jbKeyTrimmed = typeof jbKey === 'string' ? jbKey.trim() : '';
  const jbQ = jamBaseQuotaFromEnv(c.env);

  const [enrichedArtists, enrichedVenues] = await Promise.all([
    enrichSearchArtistsWithJamBase(jbKeyTrimmed || undefined, jbQ, artistsBase, jambase.artists),
    enrichSearchVenuesWithJamBase(jbKeyTrimmed || undefined, jbQ, venuesBase, jambase.venues),
  ]);

  cacheJsonProxy(c, { browserMaxAge: 90, cdnMaxAge: 600, staleWhileRevalidate: 900 });

  return c.json({
    clips: clips.results || [],
    artists: enrichedArtists,
    venues: enrichedVenues,
    users: users.results || [],
    jambase,
    jambaseNotice,
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

  cacheJsonProxy(c, { browserMaxAge: 120, cdnMaxAge: 600, staleWhileRevalidate: 900 });

  return c.json({
    clips: trendingClips.results || [],
    artists: trendingArtists.results || [],
    venues: trendingVenues.results || [],
  });
}

/** Home Discover tab: trending clips, JamBase-enriched artists, nearby upcoming shows. */
export async function getDiscoverFeed(c: Context) {
  const mochaUser = c.get('user') as MochaUser | undefined;

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
    LIMIT 12`,
  ).all();

  const trendingArtistsRaw = await c.env.DB.prepare(
    `SELECT
      clips.artist_name as name,
      MAX(artists.image_url) as image_url,
      MAX(clips.jambase_artist_id) as jambase_id,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    GROUP BY clips.artist_name
    ORDER BY clip_count DESC
    LIMIT 12`,
  ).all();

  const location = await resolveDiscoverLocation(c, mochaUser ?? null);
  const jbQ = jamBaseQuotaFromEnv(c.env);
  const apiKey = c.env.JAMBASE_API_KEY;

  const artistsBase = (trendingArtistsRaw.results ?? []) as TrendingArtistRow[];
  const [artists, nearbyEvents] = await Promise.all([
    enrichTrendingArtistsWithJamBase(apiKey, jbQ, artistsBase),
    fetchNearbyJamBaseEvents(
      apiKey,
      jbQ,
      location.latitude,
      location.longitude,
      50,
      20,
    ),
  ]);

  let jambaseNotice: string | null = null;
  if (!jamBaseApiKeyConfigured(apiKey)) {
    jambaseNotice = jamBaseMissingKeyNotice();
  } else if (nearbyEvents.length === 0 && artists.every((a) => !a.image_url)) {
    jambaseNotice = 'No nearby shows or JamBase images returned for this area.';
  }

  const forYou = await buildDiscoverForYou(
    c,
    mochaUser ?? null,
    location,
    nearbyEvents as Record<string, unknown>[],
  );

  if (mochaUser) {
    c.header('Cache-Control', 'private, no-store, must-revalidate');
  } else {
    cacheJsonProxy(c, { browserMaxAge: 120, cdnMaxAge: 600, staleWhileRevalidate: 900 });
  }

  return c.json({
    clips: trendingClips.results || [],
    artists,
    nearbyEvents,
    location,
    jambaseNotice,
    forYou,
  });
}

/** IP or profile-based nearby JamBase events (home feed, logged in or out). */
export async function getNearbyShows(c: Context) {
  const mochaUser = c.get('user') as MochaUser | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '12', 10), 40);
  const radiusMiles = Math.min(
    100,
    Math.max(10, parseInt(c.req.query('radius_miles') || '50', 10)),
  );

  const location = await resolveDiscoverLocation(c, mochaUser ?? null);
  const jbQ = jamBaseQuotaFromEnv(c.env);
  const apiKey = c.env.JAMBASE_API_KEY;

  let jambaseNotice: string | null = null;
  if (!jamBaseApiKeyConfigured(apiKey)) {
    jambaseNotice = jamBaseMissingKeyNotice();
  }

  const events = await fetchNearbyJamBaseEvents(
    apiKey,
    jbQ,
    location.latitude,
    location.longitude,
    radiusMiles,
    limit,
  );

  if (!jambaseNotice && events.length === 0 && jamBaseApiKeyConfigured(apiKey)) {
    jambaseNotice =
      'No upcoming JamBase shows were returned for this location. Try a larger radius or check worker logs for upstream errors.';
  }

  cacheJsonProxy(c, { browserMaxAge: 120, cdnMaxAge: 600, staleWhileRevalidate: 900 });

  return c.json({
    events,
    location,
    personalized: true,
    source: 'jambase' as const,
    jambaseNotice,
  });
}
