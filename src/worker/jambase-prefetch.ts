import {
  jamBaseApiKeyConfigured,
  jamBaseFetch,
  jamBaseQuotaFromEnv,
  type JamBaseQuotaContext,
} from './jambase-client';
import { jamBaseVenueEventLookbackDateFrom } from '../shared/jambase-event-day';
import {
  jamBaseEventListKey,
  jamBaseListCacheIsFresh,
  jamBaseNameKey,
  lookupArtistIdByName,
  lookupVenueIdByName,
  seedJamBaseIdCachesFromLocal,
} from './jambase-cache';
import { normalizeArtistDisplayName } from './favorite-artists-sync';

/** 07:15 UTC — off-peak for US evening traffic. */
export const JAMBASE_NIGHTLY_CRON = '15 7 * * *';

const PREFETCH_MAX_ARTISTS = 40;
const PREFETCH_MAX_VENUES = 20;
const PREFETCH_MAX_UPSTREAM = 40;
const PREFETCH_PER_PAGE = '40';

export type JamBasePrefetchResult = {
  seededArtists: number;
  seededVenues: number;
  artistsConsidered: number;
  venuesConsidered: number;
  listsWarmed: number;
  skippedFresh: number;
  upstreamAttempts: number;
};

async function distinctFavoriteArtistNames(db: D1Database): Promise<string[]> {
  const names = new Set<string>();
  const linked = await db
    .prepare(
      `SELECT DISTINCT artists.name AS name
       FROM user_favorite_artists
       INNER JOIN artists ON artists.id = user_favorite_artists.artist_id
       WHERE TRIM(IFNULL(artists.name, '')) != ''
       LIMIT 200`,
    )
    .all<{ name: string }>();
  for (const row of linked.results ?? []) {
    const n = normalizeArtistDisplayName(row.name);
    if (n) names.add(n);
  }

  const profiles = await db
    .prepare(
      `SELECT favorite_artists FROM user_profiles
       WHERE TRIM(IFNULL(favorite_artists, '')) != ''
       LIMIT 200`,
    )
    .all<{ favorite_artists: string | null }>();
  for (const row of profiles.results ?? []) {
    const raw = row.favorite_artists;
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const n = normalizeArtistDisplayName(String(item ?? ''));
          if (n) names.add(n);
        }
      }
    } catch {
      /* ignore malformed JSON */
    }
  }

  return [...names];
}

async function distinctFollowedVenues(
  db: D1Database,
): Promise<Array<{ name: string; jambase_id: string | null }>> {
  const followRows = await db
    .prepare(
      `SELECT following_id FROM follows WHERE following_id LIKE 'venue-%' LIMIT 300`,
    )
    .all<{ following_id: string }>();
  const venueIds: number[] = [];
  for (const row of followRows.results ?? []) {
    const m = /^venue-(\d+)$/.exec(String(row.following_id ?? '').trim());
    if (!m) continue;
    const id = Number(m[1]);
    if (Number.isFinite(id) && id > 0) venueIds.push(Math.trunc(id));
  }
  if (venueIds.length === 0) return [];
  const placeholders = venueIds.map(() => '?').join(',');
  const venues = await db
    .prepare(
      `SELECT name, jambase_id FROM venues WHERE id IN (${placeholders}) AND TRIM(IFNULL(name, '')) != ''`,
    )
    .bind(...venueIds)
    .all<{ name: string; jambase_id: string | null }>();
  return (venues.results ?? []).map((v) => ({
    name: String(v.name),
    jambase_id: typeof v.jambase_id === 'string' && v.jambase_id.trim() ? v.jambase_id.trim() : null,
  }));
}

async function listIsFresh(db: D1Database, listKey: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT fetched_at FROM jambase_event_lists WHERE list_key = ? LIMIT 1`)
    .bind(listKey)
    .first<{ fetched_at: string }>();
  return Boolean(row && jamBaseListCacheIsFresh(row.fetched_at));
}

async function resolveArtistJamBaseId(
  db: D1Database,
  apiKey: string,
  jbQ: JamBaseQuotaContext,
  name: string,
  budget: { remaining: number },
): Promise<string | null> {
  const cached = await lookupArtistIdByName(db, name);
  if (cached?.jambase_id) return cached.jambase_id;
  if (budget.remaining <= 0) return null;
  budget.remaining -= 1;
  const data = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
    apiKey,
    '/artists',
    { artistName: name, perPage: '8', page: '1' },
    jbQ,
  );
  const artists = data?.artists ?? [];
  const key = jamBaseNameKey(name);
  const exact = artists.find((a) => jamBaseNameKey(String(a.name ?? '')) === key);
  const pick = exact ?? artists[0];
  const id = typeof pick?.identifier === 'string' ? pick.identifier.trim() : '';
  return id || null;
}

async function resolveVenueJamBaseId(
  db: D1Database,
  apiKey: string,
  jbQ: JamBaseQuotaContext,
  venue: { name: string; jambase_id: string | null },
  budget: { remaining: number },
): Promise<string | null> {
  if (venue.jambase_id) return venue.jambase_id;
  const cached = await lookupVenueIdByName(db, venue.name);
  if (cached?.jambase_id) return cached.jambase_id;
  if (budget.remaining <= 0) return null;
  budget.remaining -= 1;
  const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
    apiKey,
    '/venues',
    { venueName: venue.name, perPage: '8', page: '1' },
    jbQ,
  );
  const venues = data?.venues ?? [];
  const key = jamBaseNameKey(venue.name);
  const exact = venues.find((v) => jamBaseNameKey(String(v.name ?? '')) === key);
  const pick = exact ?? venues[0];
  const id = typeof pick?.identifier === 'string' ? pick.identifier.trim() : '';
  return id || null;
}

/**
 * Nightly warmup: fetch upcoming calendars for favorited artists and followed venues.
 * Skips lists still within the 72h TTL. Caps upstream calls so daytime quota stays intact.
 */
export async function prefetchJamBaseFavoriteCalendars(env: Env): Promise<JamBasePrefetchResult> {
  const result: JamBasePrefetchResult = {
    seededArtists: 0,
    seededVenues: 0,
    artistsConsidered: 0,
    venuesConsidered: 0,
    listsWarmed: 0,
    skippedFresh: 0,
    upstreamAttempts: 0,
  };

  if (!jamBaseApiKeyConfigured(env.JAMBASE_API_KEY)) {
    console.warn('[JamBase prefetch] skipped: no API key');
    return result;
  }

  const db = env.DB;
  const jbQ = jamBaseQuotaFromEnv(env);
  const apiKey = env.JAMBASE_API_KEY;
  const budget = { remaining: PREFETCH_MAX_UPSTREAM };

  const seeded = await seedJamBaseIdCachesFromLocal(db);
  result.seededArtists = seeded.artists;
  result.seededVenues = seeded.venues;

  const artistNames = (await distinctFavoriteArtistNames(db)).slice(0, PREFETCH_MAX_ARTISTS);
  const venues = (await distinctFollowedVenues(db)).slice(0, PREFETCH_MAX_VENUES);
  result.artistsConsidered = artistNames.length;
  result.venuesConsidered = venues.length;

  const dateFrom = jamBaseVenueEventLookbackDateFrom();

  for (const name of artistNames) {
    if (budget.remaining <= 0) break;
    const artistId = await resolveArtistJamBaseId(db, apiKey, jbQ, name, budget);
    if (!artistId) continue;
    const listKey = jamBaseEventListKey('artist', artistId);
    if (await listIsFresh(db, listKey)) {
      result.skippedFresh += 1;
      continue;
    }
    budget.remaining -= 1;
    result.upstreamAttempts += 1;
    await jamBaseFetch(
      apiKey,
      '/events',
      {
        artistId,
        eventDateFrom: dateFrom,
        expandPastEvents: 'true',
        perPage: PREFETCH_PER_PAGE,
        page: '1',
      },
      jbQ,
    );
    result.listsWarmed += 1;
  }

  for (const venue of venues) {
    if (budget.remaining <= 0) break;
    const venueId = await resolveVenueJamBaseId(db, apiKey, jbQ, venue, budget);
    if (!venueId) continue;
    const listKey = jamBaseEventListKey('venue', venueId);
    if (await listIsFresh(db, listKey)) {
      result.skippedFresh += 1;
      continue;
    }
    budget.remaining -= 1;
    result.upstreamAttempts += 1;
    await jamBaseFetch(
      apiKey,
      '/events',
      {
        venueId,
        eventDateFrom: dateFrom,
        expandPastEvents: 'true',
        perPage: PREFETCH_PER_PAGE,
        page: '1',
      },
      jbQ,
    );
    result.listsWarmed += 1;
  }

  console.log('[JamBase prefetch] completed', result);
  return result;
}
