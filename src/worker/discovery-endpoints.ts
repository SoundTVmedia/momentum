import { Context } from 'hono';
import type { MochaUser } from '@/shared/mocha-user';
import {
  jamBaseFetch,
  jamBaseMissingKeyNotice,
  jamBaseApiKeyConfigured,
  jamBaseQuotaFromEnv,
  type JamBaseFetchDiag,
  type JamBaseQuotaContext,
} from './jambase-client';
import { cacheJsonProxy } from './performance-utils';
import {
  buildTightJamBaseEventResults,
  jamBaseArtistVenueSearchPhrase,
} from './jambase-events-search';
import { resolveDiscoverLocation } from './discover-location';
import { buildDiscoverForYou } from './discover-for-you';
import {
  enrichSearchVenuesWithJamBase,
  enrichTrendingArtistsWithJamBase,
  fetchNearbyJamBaseEvents,
  fetchJamBaseVenuesByCity,
  jamBaseVenueToSearchRow,
  mapJamBaseArtistsToSearchRows,
  matchSearchVenuesToJamBaseCatalog,
  type SearchVenueRow,
  type TrendingArtistRow,
} from './discover-jambase-enrich';
import {
  clipGeoWhereClause,
  filterJamBaseRecordsInRadius,
  parseSearchRadiusMiles,
  resolveSearchGeoAnchor,
  resolveUserSearchRadius,
  type SearchGeoAnchor,
} from './search-geo';

async function fetchJamBaseCompactCatalog(
  apiKey: string,
  query: string,
  jbQ: JamBaseQuotaContext | undefined,
): Promise<{ artists: unknown[]; venues: unknown[] }> {
  const phrase = jamBaseArtistVenueSearchPhrase(query);
  const [a, v] = await Promise.all([
    jamBaseFetch<{ artists?: unknown[] }>(
      apiKey,
      '/artists',
      { artistName: phrase, perPage: '4', page: '1' },
      jbQ,
    ),
    jamBaseFetch<{ venues?: unknown[] }>(
      apiKey,
      '/venues',
      { venueName: phrase, perPage: '4', page: '1' },
      jbQ,
    ),
  ]);
  return { artists: a?.artists ?? [], venues: v?.venues ?? [] };
}

function venueDedupeKey(name: string): string {
  return name.trim().toLowerCase();
}

function mergeSearchVenueRows(primary: SearchVenueRow[], extra: SearchVenueRow[]): SearchVenueRow[] {
  const seen = new Set(primary.map((v) => venueDedupeKey(v.name)));
  const merged = [...primary];
  for (const row of extra) {
    const key = venueDedupeKey(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

async function runGeoScopedAdvancedSearch(
  c: Context,
  opts: {
    trimmedQuery: string;
    geoAnchor: SearchGeoAnchor;
    radiusMiles: number;
    compact: boolean;
    clipLimit: number;
    venueLimit: number;
    dateRange: string;
    sortBy: string;
    jbKeyTrimmed: string;
    jbQ: ReturnType<typeof jamBaseQuotaFromEnv>;
  },
) {
  const { geoAnchor, radiusMiles, compact, clipLimit, venueLimit, dateRange, sortBy, jbKeyTrimmed, jbQ } =
    opts;
  const geo = clipGeoWhereClause(geoAnchor, radiusMiles);

  let daysBack = 30;
  switch (dateRange) {
    case '7d':
      daysBack = 7;
      break;
    case '90d':
      daysBack = 90;
      break;
    case 'all':
      daysBack = 36500;
      break;
    default:
      daysBack = 30;
  }

  let clipsQuery = `
    SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0`;

  const clipsBindings: unknown[] = [];

  if (!compact) {
    clipsQuery += ` AND clips.created_at >= date('now', '-' || ? || ' days')`;
    clipsBindings.push(daysBack);
  }

  clipsQuery += ` AND ${geo.sql}`;
  clipsBindings.push(...geo.bindings);

  switch (sortBy) {
    case 'trending':
      clipsQuery += ` ORDER BY clips.likes_count DESC, clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'most_liked':
      clipsQuery += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case 'most_viewed':
      clipsQuery += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
      break;
    default:
      clipsQuery += ` ORDER BY clips.created_at DESC`;
  }
  clipsQuery += ` LIMIT ${clipLimit}`;

  const artistsQuery = `
    SELECT
      clips.artist_name as name,
      MAX(artists.image_url) as image_url,
      MAX(clips.jambase_artist_id) as jambase_id,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.is_hidden = 0
    AND ${geo.sql}
    GROUP BY clips.artist_name
    ORDER BY clip_count DESC
    LIMIT ${compact ? 4 : 12}`;

  const venuesQuery =
    venueLimit > 0
      ? `
    SELECT
      clips.venue_name as name,
      MAX(venues.location) as location,
      MAX(venues.image_url) as image_url,
      MAX(clips.jambase_venue_id) as jambase_id,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.is_hidden = 0
    AND ${geo.sql}
    GROUP BY clips.venue_name
    ORDER BY clip_count DESC
    LIMIT ${venueLimit}`
      : null;

  const jbCity = geoAnchor.city || geoAnchor.state || opts.trimmedQuery;
  const hasGeoCoords =
    Number.isFinite(geoAnchor.latitude) && Number.isFinite(geoAnchor.longitude);

  const jbPromise =
    jbKeyTrimmed && jbCity.trim()
      ? Promise.all([
          fetchJamBaseVenuesByCity(
            jbKeyTrimmed,
            jbQ,
            jbCity,
            geoAnchor.countryIso2,
            compact ? 6 : 20,
          ),
          hasGeoCoords
            ? fetchNearbyJamBaseEvents(
                jbKeyTrimmed,
                jbQ,
                geoAnchor.latitude,
                geoAnchor.longitude,
                radiusMiles,
                compact ? 6 : 20,
              )
            : Promise.resolve([] as Record<string, unknown>[]),
        ]).then(([venues, events]) => ({
          venues: filterJamBaseRecordsInRadius(venues, geoAnchor, radiusMiles),
          events: filterJamBaseRecordsInRadius(events, geoAnchor, radiusMiles),
          failed: false,
        }))
      : Promise.resolve({
          venues: [] as Record<string, unknown>[],
          events: [] as Record<string, unknown>[],
          failed: false,
        });

  const [clips, artists, venues, jbResult] = await Promise.all([
    c.env.DB.prepare(clipsQuery).bind(...clipsBindings).all(),
    c.env.DB.prepare(artistsQuery).bind(...geo.bindings).all(),
    venuesQuery
      ? c.env.DB.prepare(venuesQuery).bind(...geo.bindings).all()
      : Promise.resolve({ results: [] as SearchVenueRow[] }),
    jbPromise,
  ]);

  const jbVenueCatalog = jbResult.venues;
  const jbVenueRows = jbVenueCatalog
    .map((v) => jamBaseVenueToSearchRow(v))
    .filter((r): r is SearchVenueRow => r != null);

  const venuesBase = mergeSearchVenueRows(
    (venues.results ?? []) as SearchVenueRow[],
    jbVenueRows,
  );

  const artistsBase = (artists.results ?? []) as TrendingArtistRow[];
  const [enrichedArtists, enrichedVenues] = await Promise.all([
    enrichTrendingArtistsWithJamBase(jbKeyTrimmed || undefined, jbQ, artistsBase),
    compact
      ? Promise.resolve(matchSearchVenuesToJamBaseCatalog(venuesBase, jbVenueCatalog))
      : enrichSearchVenuesWithJamBase(
          c.env.DB,
          jbKeyTrimmed || undefined,
          jbQ,
          venuesBase,
          jbVenueCatalog,
        ),
  ]);

  let jambaseNotice: string | null = null;
  if (jbResult.failed) {
    jambaseNotice =
      'JamBase results for this area did not load. Your Feedback clips in this location are unchanged.';
  } else if (!jamBaseApiKeyConfigured(jbKeyTrimmed)) {
    jambaseNotice = jamBaseMissingKeyNotice();
  }

  cacheJsonProxy(c, {
    browserMaxAge: compact ? 120 : 90,
    cdnMaxAge: compact ? 900 : 600,
    staleWhileRevalidate: 900,
  });

  return c.json({
    clips: clips.results || [],
    artists: enrichedArtists,
    venues: enrichedVenues,
    users: [],
    jambase: {
      artists: [],
      venues: [],
      events: jbResult.events,
    },
    jambaseNotice,
    locationScoped: true,
    searchGeo: {
      label: geoAnchor.label,
      radius_miles: radiusMiles,
    },
  });
}

// Advanced search with filters
export async function advancedSearch(c: Context) {
  const mochaUser = c.get('user') as MochaUser | undefined;
  const query = c.req.query('q') || '';
  const location = c.req.query('location') || '';
  const dateRange = c.req.query('dateRange') || '30d';
  const sortBy = c.req.query('sortBy') || 'latest';
  const compact = c.req.query('compact') === '1';
  const clipLimit = compact ? 6 : 30;
  const venueLimit = compact ? 0 : 20;
  const userLimit = compact ? 3 : 20;
  
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

  const trimmedQuery = query.trim();
  const jbKey = c.env.JAMBASE_API_KEY;
  const jbKeyTrimmed = typeof jbKey === 'string' ? jbKey.trim() : '';
  const jbQ = jamBaseQuotaFromEnv(c.env);

  const [profileRadiusMiles, geoAnchor] = await Promise.all([
    resolveUserSearchRadius(c.env.DB, mochaUser ?? null),
    resolveSearchGeoAnchor(c.env.GOOGLE_MAPS_API_KEY, trimmedQuery),
  ]);
  const radiusMiles = parseSearchRadiusMiles(c.req.query('radius_miles')) ?? profileRadiusMiles;

  if (geoAnchor) {
    return runGeoScopedAdvancedSearch(c, {
      trimmedQuery,
      geoAnchor,
      radiusMiles,
      compact,
      clipLimit,
      venueLimit,
      dateRange,
      sortBy,
      jbKeyTrimmed,
      jbQ,
    });
  }

  const like = `%${query}%`;

  let daysBack = 30;
  switch (dateRange) {
    case '7d': daysBack = 7; break;
    case '90d': daysBack = 90; break;
    case 'all': daysBack = 36500; break; // ~100 years
    default: daysBack = 30;
  }

  // Search clips
  let clipsQuery: string;
  let clipsBindings: unknown[];

  if (compact) {
    clipsQuery = `
    SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND (
      clips.artist_name LIKE ? OR
      clips.venue_name LIKE ?
    )
    ORDER BY clips.created_at DESC
    LIMIT ${clipLimit}`;
    clipsBindings = [like, like];
  } else {
    clipsQuery = `
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
    )`;
    clipsBindings = [daysBack, like, like, like, like, like];

    if (location) {
      clipsQuery += ` AND clips.location LIKE ?`;
      clipsBindings.push(`%${location}%`);
    }

    switch (sortBy) {
      case 'trending':
        clipsQuery += ` ORDER BY clips.likes_count DESC, clips.views_count DESC, clips.created_at DESC`;
        break;
      case 'most_liked':
        clipsQuery += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
        break;
      case 'most_viewed':
        clipsQuery += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
        break;
      default:
        clipsQuery += ` ORDER BY clips.created_at DESC`;
    }

    clipsQuery += ` LIMIT ${clipLimit}`;
  }

  const d1Promise = Promise.all([
    c.env.DB.prepare(clipsQuery).bind(...clipsBindings).all(),
    venueLimit > 0
      ? c.env.DB.prepare(
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
    LIMIT ${venueLimit}`,
        )
          .bind(like)
          .all()
      : Promise.resolve({ results: [] as SearchVenueRow[] }),
    c.env.DB.prepare(
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
    LIMIT ${userLimit}`,
    )
      .bind(like)
      .all(),
  ]);

  const jbPromise =
    trimmedQuery.length >= 2 && jbKeyTrimmed
      ? compact
        ? fetchJamBaseCompactCatalog(jbKeyTrimmed, trimmedQuery, jbQ).then((jb) => ({
            artists: jb.artists,
            venues: jb.venues,
            events: [] as unknown[],
            failed: false,
          }))
        : (async () => {
            const q = trimmedQuery;
            const jbPer = '10';
            const eventCap = 18;
            const phrase = jamBaseArtistVenueSearchPhrase(q);
            const [a, v] = await Promise.all([
              jamBaseFetch<{ artists?: unknown[] }>(
                jbKeyTrimmed,
                '/artists',
                { artistName: phrase, perPage: jbPer, page: '1' },
                jbQ,
              ),
              jamBaseFetch<{ venues?: unknown[] }>(
                jbKeyTrimmed,
                '/venues',
                { venueName: phrase, perPage: jbPer, page: '1' },
                jbQ,
              ),
            ]);
            const eventList = await buildTightJamBaseEventResults(jbKeyTrimmed, q, eventCap, jbQ, {
              artistList: a as { artists?: Record<string, unknown>[] } | null,
              venueList: v as { venues?: Record<string, unknown>[] } | null,
            });
            return {
              artists: a?.artists ?? [],
              venues: v?.venues ?? [],
              events: eventList,
              failed: a == null && v == null,
            };
          })()
      : Promise.resolve({
          artists: [] as unknown[],
          venues: [] as unknown[],
          events: [] as unknown[],
          failed: false,
        });

  const [[clips, venues, users], jbResult] = await Promise.all([d1Promise, jbPromise]);

  const jambase = {
    artists: jbResult.artists,
    venues: jbResult.venues,
    events: jbResult.events,
  };
  let jambaseNotice: string | null = null;
  if (jbResult.failed) {
    jambaseNotice =
      'JamBase artist/venue search did not complete (network error, invalid API key, or JAMBASE_QUOTA_ENFORCEMENT may have blocked upstream calls). Your Feedback clips and on-platform matches below are unchanged — check worker logs.';
  } else if (trimmedQuery.length >= 2 && !jamBaseApiKeyConfigured(jbKey)) {
    jambaseNotice = jamBaseMissingKeyNotice();
  }

  const venuesBase = (venues.results ?? []) as SearchVenueRow[];
  const searchArtists = mapJamBaseArtistsToSearchRows(jambase.artists);
  const enrichedVenues = compact
    ? matchSearchVenuesToJamBaseCatalog(venuesBase, jambase.venues)
    : await enrichSearchVenuesWithJamBase(
        c.env.DB,
        jbKeyTrimmed || undefined,
        jbQ,
        venuesBase,
        jambase.venues,
      );

  cacheJsonProxy(c, {
    browserMaxAge: compact ? 120 : 90,
    cdnMaxAge: compact ? 900 : 600,
    staleWhileRevalidate: 900,
  });

  return c.json({
    clips: clips.results || [],
    artists: searchArtists,
    venues: enrichedVenues,
    users: users.results || [],
    jambase: {
      artists: [],
      venues: jambase.venues,
      events: jambase.events,
    },
    jambaseNotice,
  });
}

// Get trending content
export async function getTrendingContent(c: Context) {
  // Trending clips — highest likes, then views
  const trendingClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND clips.is_draft = 0
    ORDER BY clips.likes_count DESC, clips.views_count DESC, clips.created_at DESC
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

/** Discover page carousel always shows this many trending artists when data exists. */
export const DISCOVER_TRENDING_ARTIST_COUNT = 5;

function artistDedupeKey(name: string): string {
  return name.trim().toLowerCase();
}

function trendingArtistFromRow(row: Record<string, unknown>): TrendingArtistRow | null {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) return null;
  return {
    name,
    image_url: typeof row.image_url === 'string' ? row.image_url : null,
    clip_count: Number(row.clip_count) || 0,
    jambase_id: typeof row.jambase_id === 'string' ? row.jambase_id : null,
  };
}

function mergeTrendingArtists(
  base: TrendingArtistRow[],
  extra: TrendingArtistRow[],
  target: number,
): TrendingArtistRow[] {
  const seen = new Set(base.map((a) => artistDedupeKey(a.name)));
  const merged = [...base];
  for (const row of extra) {
    if (merged.length >= target) break;
    const key = artistDedupeKey(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged.slice(0, target);
}

/**
 * Pad trending artists to `target` using all-time clip leaders, then the artists catalog.
 */
export async function ensureDiscoverTrendingArtists(
  db: D1Database,
  primary: TrendingArtistRow[],
  target: number = DISCOVER_TRENDING_ARTIST_COUNT,
): Promise<TrendingArtistRow[]> {
  let merged = mergeTrendingArtists(primary, [], target);
  if (merged.length >= target) return merged;

  const excludeFromClips = merged.map((a) => a.name);
  const needFromClips = target - merged.length;
  const notInClause =
    excludeFromClips.length > 0
      ? `AND clips.artist_name NOT IN (${excludeFromClips.map(() => '?').join(',')})`
      : '';

  const allTime = await db
    .prepare(
      `SELECT
        clips.artist_name as name,
        MAX(artists.image_url) as image_url,
        MAX(clips.jambase_artist_id) as jambase_id,
        COUNT(DISTINCT clips.id) as clip_count
      FROM clips
      LEFT JOIN artists ON clips.artist_name = artists.name
      WHERE clips.artist_name IS NOT NULL
      AND clips.is_hidden = 0
      ${notInClause}
      GROUP BY clips.artist_name
      ORDER BY clip_count DESC
      LIMIT ?`,
    )
    .bind(...excludeFromClips, needFromClips)
    .all();

  const allTimeRows = (allTime.results ?? [])
    .map((r) => trendingArtistFromRow(r as Record<string, unknown>))
    .filter((r): r is TrendingArtistRow => r != null);
  merged = mergeTrendingArtists(merged, allTimeRows, target);
  if (merged.length >= target) return merged;

  const excludeFromCatalog = merged.map((a) => a.name);
  const needFromCatalog = target - merged.length;
  const catalogNotIn =
    excludeFromCatalog.length > 0
      ? `AND name NOT IN (${excludeFromCatalog.map(() => '?').join(',')})`
      : '';

  const catalog = await db
    .prepare(
      `SELECT
        name,
        image_url,
        NULL as jambase_id,
        0 as clip_count
      FROM artists
      WHERE name IS NOT NULL AND trim(name) != ''
      ${catalogNotIn}
      ORDER BY updated_at DESC, name ASC
      LIMIT ?`,
    )
    .bind(...excludeFromCatalog, needFromCatalog)
    .all();

  const catalogRows = (catalog.results ?? [])
    .map((r) => trendingArtistFromRow(r as Record<string, unknown>))
    .filter((r): r is TrendingArtistRow => r != null);
  return mergeTrendingArtists(merged, catalogRows, target);
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
    AND clips.is_draft = 0
    ORDER BY clips.likes_count DESC, clips.views_count DESC, clips.created_at DESC
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
  const artistsForDiscover = await ensureDiscoverTrendingArtists(
    c.env.DB,
    artistsBase,
    DISCOVER_TRENDING_ARTIST_COUNT,
  );
  const [artists, nearbyEvents] = await Promise.all([
    enrichTrendingArtistsWithJamBase(apiKey, jbQ, artistsForDiscover),
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

  const jbDiag: JamBaseFetchDiag = {};
  const events = await fetchNearbyJamBaseEvents(
    apiKey,
    jbQ,
    location.latitude,
    location.longitude,
    radiusMiles,
    limit,
    jbDiag,
  );

  if (!jambaseNotice && events.length === 0 && jamBaseApiKeyConfigured(apiKey)) {
    if (jbDiag.failure === 'timeout') {
      jambaseNotice =
        'JamBase timed out loading nearby shows. Try again in a moment — if this keeps happening, check JAMBASE_API_KEY and worker logs.';
    } else if (jbDiag.failure === 'quota') {
      jambaseNotice =
        'JamBase call quota reached (JAMBASE_QUOTA_ENFORCEMENT). Nearby shows are paused until the budget resets.';
    } else if (jbDiag.failure === 'http' && (jbDiag.httpStatus === 401 || jbDiag.httpStatus === 403)) {
      jambaseNotice =
        'JamBase rejected the API key (401/403). Regenerate your key at data.jambase.com and update JAMBASE_API_KEY.';
    } else if (jbDiag.failure) {
      jambaseNotice =
        'JamBase did not return nearby shows (upstream error). Check JAMBASE_API_KEY and worker logs.';
    } else {
      jambaseNotice =
        'No upcoming JamBase shows were returned for this location. Try a larger radius or check again later.';
    }
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
