import type { Context } from 'hono';
import {
  jamBaseFetch,
  jamBaseQuotaFromEnv,
  jamBaseQuotaPrecheck,
  type JamBaseFetchDiag,
  type JamBaseQuotaContext,
} from './jambase-client';
import { headlinerFromEvent } from './jambase-map';
import type { ClipShowCandidate } from '../shared/types';

/** Extra miles beyond profile radius so GPS jitter does not drop the venue you are standing in front of. */
const GPS_DISTANCE_SLACK_MILES = 1.25;

/** JamBase `/venues` lat+lon search uses at least this many miles so sparse areas still return rows. */
const VENUE_JAMBASE_SEARCH_MIN_MILES = 35;

/** Optional JamBase radius beyond profile radius when calling `/venues` (still filter by profile radius when coords exist). */
const VENUE_JAMBASE_SEARCH_BUFFER_MILES = 25;

/** Never match tighter than this when comparing GPS ↔ venue coords (profile can be 1–5 mi). */
const VENUE_MATCH_RADIUS_FLOOR_MILES = 35;

type CandidateGeoTrust = { trustJamBaseGeoList?: boolean };

const VENUES_PER_PAGE = '100';
const VENUE_GEO_CITY_MAX_PAGES = 5;

type ClipResolveMatch = 'none' | 'single';

async function recordResolveTelemetry(
  c: Context,
  mochaUserId: string,
  match: ClipResolveMatch,
  radiusMiles: number,
  rawEventCount: number,
  candidateCount: number,
  geoCityId: string | null,
  source: string,
  notice: string | null
): Promise<void> {
  try {
    await c.env.DB.prepare(
      `INSERT INTO clip_show_resolve_telemetry
       (mocha_user_id, match, radius_miles, raw_event_count, candidate_count, geo_city_id, source, notice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        mochaUserId,
        match,
        radiusMiles,
        rawEventCount,
        candidateCount,
        geoCityId,
        source,
        notice
      )
      .run();
  } catch (e) {
    console.error('clip_show_resolve_telemetry insert failed:', e);
  }
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function extractVenueCoords(ev: Record<string, unknown>): { lat: number; lon: number } | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  if (loc) {
    const geo = loc.geo as Record<string, unknown> | undefined;
    if (geo) {
      const lat = Number(geo.latitude ?? geo.lat);
      const lon = Number(geo.longitude ?? geo.lon ?? geo.lng);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    const addr = loc.address as Record<string, unknown> | undefined;
    if (addr) {
      const ag = addr.geo as Record<string, unknown> | undefined;
      if (ag) {
        const lat = Number(ag.latitude ?? ag.lat);
        const lon = Number(ag.longitude ?? ag.lon ?? ag.lng);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
      }
    }
    const latLoc = Number(loc.latitude ?? loc.lat);
    const lonLoc = Number(loc.longitude ?? loc.lon ?? loc.lng);
    if (Number.isFinite(latLoc) && Number.isFinite(lonLoc)) return { lat: latLoc, lon: lonLoc };
  }
  const rootGeo = ev.geo as Record<string, unknown> | undefined;
  if (rootGeo) {
    const lat = Number(rootGeo.latitude ?? rootGeo.lat);
    const lon = Number(rootGeo.longitude ?? rootGeo.lon ?? rootGeo.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const rlat = Number(ev.latitude);
  const rlon = Number(ev.longitude);
  if (Number.isFinite(rlat) && Number.isFinite(rlon)) return { lat: rlat, lon: rlon };
  return null;
}

function venueRootIdentifier(v: Record<string, unknown>): string | null {
  if (typeof v.identifier === 'string' && v.identifier.trim()) return v.identifier.trim();
  if (typeof v.id === 'string' && v.id.trim()) return v.id.trim();
  return null;
}

function venueCityStateLine(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  /** `/venues` returns `MusicVenue` with `address` at root; events nest under `location`. */
  const addr = (loc?.address ?? ev.address) as Record<string, unknown> | undefined;
  const cityFromAddr = typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
  const cityFlat = typeof loc?.city === 'string' ? (loc.city as string) : '';
  const stateFlat = typeof loc?.state === 'string' ? (loc.state as string) : '';
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const st =
    typeof region?.alternateName === 'string'
      ? region.alternateName
      : typeof region?.name === 'string'
        ? (region.name as string)
        : '';
  const city = cityFromAddr || cityFlat;
  const regionPart = st || stateFlat;
  const line = [city, regionPart].filter(Boolean).join(', ');
  return line || null;
}

function venueNameFromEvent(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.name === 'string' ? loc.name : null;
}

function venueIdentifier(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.identifier === 'string' ? loc.identifier : null;
}

async function nominatimReverse(
  lat: number,
  lon: number
): Promise<{
  city: string | null;
  state: string | null;
  country_code: string | null;
  postcode: string | null;
} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Feedback/1.0 (https://github.com/)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    const address = data.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.suburb ||
      address.neighbourhood ||
      address.municipality ||
      address.county ||
      null;
    const state = address.state || null;
    const country_code = address.country_code ? address.country_code.toUpperCase() : null;
    const postcode = address.postcode ? address.postcode.trim() : null;
    return { city, state, country_code, postcode };
  } catch (e) {
    console.error('Nominatim reverse failed:', e);
    return null;
  }
}

function distanceSortKey(d: number | null): number {
  if (d == null || !Number.isFinite(d)) return Number.POSITIVE_INFINITY;
  return d;
}

function sortCandidatesByDistance(cands: ClipShowCandidate[]): ClipShowCandidate[] {
  return [...cands].sort((a, b) => distanceSortKey(a.distance_miles) - distanceSortKey(b.distance_miles));
}

/** When JamBase returns a single venue row for this search but strict radius/city filters reject it, still trust that hit. */
function soleRawVenueCandidate(
  v: Record<string, unknown>,
  userLat: number,
  userLon: number
): ClipShowCandidate | null {
  const venueId = venueRootIdentifier(v);
  const venueName = typeof v.name === 'string' ? v.name : null;
  if (!venueId) return null;

  const locationLine = venueCityStateLine(v);
  const coords = extractVenueCoords(v);
  let distanceMiles: number | null = null;
  if (coords) {
    distanceMiles = haversineMiles(userLat, userLon, coords.lat, coords.lon);
  }

  return {
    jambase_event_id: null,
    jambase_artist_id: null,
    jambase_venue_id: venueId,
    artist_name: null,
    venue_name: venueName,
    location: locationLine,
    startDate: '',
    distance_miles: distanceMiles,
  };
}

/** One row per venue (or per event if venue id missing), keeping the closest hit. */
function dedupeKeepClosestPerVenue(cands: ClipShowCandidate[]): ClipShowCandidate[] {
  const map = new Map<string, ClipShowCandidate>();
  for (const row of cands) {
    const vid = row.jambase_venue_id;
    const key =
      vid && vid.length > 0
        ? `v:${vid}`
        : row.jambase_event_id
          ? `e:${row.jambase_event_id}`
          : null;
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    if (distanceSortKey(row.distance_miles) < distanceSortKey(prev.distance_miles)) {
      map.set(key, row);
    }
  }
  return sortCandidatesByDistance([...map.values()]);
}

/**
 * Pick the single closest venue/event candidate after dedupe. We do not prompt the user to
 * choose among nearby venues—the app assumes the nearest resolved row is correct.
 */
function finalizeMatch(dedupedSorted: ClipShowCandidate[]): {
  match: ClipResolveMatch;
  candidates: ClipShowCandidate[];
} {
  if (dedupedSorted.length === 0) return { match: 'none', candidates: [] };
  return { match: 'single', candidates: [dedupedSorted[0]!] };
}

function candidateFromVenue(
  v: Record<string, unknown>,
  userLat: number,
  userLon: number,
  matchRadiusMiles: number,
  userCityLower: string | null,
  opts?: CandidateGeoTrust
): ClipShowCandidate | null {
  const venueId = venueRootIdentifier(v);
  const venueName = typeof v.name === 'string' ? v.name : null;
  if (!venueId) return null;

  const locationLine = venueCityStateLine(v);
  const coords = extractVenueCoords(v);
  let distanceMiles: number | null = null;
  let withinRadius = false;

  if (coords) {
    distanceMiles = haversineMiles(userLat, userLon, coords.lat, coords.lon);
    withinRadius = distanceMiles <= matchRadiusMiles + GPS_DISTANCE_SLACK_MILES;
  } else if (userCityLower && locationLine) {
    const locLower = locationLine.toLowerCase();
    const venueCity = locationLine.split(',')[0]?.trim().toLowerCase() ?? '';
    withinRadius = venueCity === userCityLower || locLower.includes(userCityLower);
  } else {
    // JamBase already scoped lat/lon results; without reverse-geocoded city we cannot string-match.
    withinRadius = Boolean(opts?.trustJamBaseGeoList);
  }

  if (!withinRadius) return null;

  return {
    jambase_event_id: null,
    jambase_artist_id: null,
    jambase_venue_id: venueId,
    artist_name: null,
    venue_name: venueName,
    location: locationLine,
    startDate: '',
    distance_miles: distanceMiles,
  };
}

function candidateFromEvent(
  ev: Record<string, unknown>,
  userLat: number,
  userLon: number,
  matchRadiusMiles: number,
  userCityLower: string | null,
  opts?: CandidateGeoTrust
): ClipShowCandidate | null {
  const id = typeof ev.identifier === 'string' ? ev.identifier : null;
  if (!id) return null;

  const head = headlinerFromEvent(ev);
  const artistName = typeof head?.name === 'string' ? head.name : null;
  const artistId = typeof head?.identifier === 'string' ? head.identifier : null;

  const venueName = venueNameFromEvent(ev);
  const venueId = venueIdentifier(ev);
  const locationLine = venueCityStateLine(ev);

  const coords = extractVenueCoords(ev);
  let distanceMiles: number | null = null;
  let withinRadius = false;

  if (coords) {
    distanceMiles = haversineMiles(userLat, userLon, coords.lat, coords.lon);
    withinRadius = distanceMiles <= matchRadiusMiles + GPS_DISTANCE_SLACK_MILES;
  } else if (userCityLower && locationLine) {
    const locLower = locationLine.toLowerCase();
    const venueCity = locationLine.split(',')[0]?.trim().toLowerCase() ?? '';
    withinRadius = venueCity === userCityLower || locLower.includes(userCityLower);
  } else {
    withinRadius = Boolean(opts?.trustJamBaseGeoList);
  }

  if (!withinRadius) return null;

  const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';

  return {
    jambase_event_id: id,
    jambase_artist_id: artistId,
    jambase_venue_id: venueId,
    artist_name: artistName,
    venue_name: venueName,
    location: locationLine,
    startDate,
    distance_miles: distanceMiles,
  };
}

/** JamBase may return several cities for one name (e.g. suburbs); merge venues across a few IDs. */
async function resolveGeoCityIds(
  apiKey: string,
  city: string,
  countryIso2: string,
  jbQ: JamBaseQuotaContext | undefined,
  max: number
): Promise<string[]> {
  const trimmed = city.trim();
  if (!trimmed) return [];
  const cities = await jamBaseFetch<{ cities?: Record<string, unknown>[] }>(
    apiKey,
    '/geographies/cities',
    {
      geoCityName: trimmed,
      geoCountryIso2: countryIso2.slice(0, 2).toUpperCase(),
    },
    jbQ
  );
  const ids: string[] = [];
  for (const row of (cities?.cities ?? []).slice(0, max)) {
    if (typeof row.identifier === 'string') ids.push(row.identifier);
  }
  return ids;
}

async function fetchVenuesPaginatedByGeoCity(
  apiKey: string,
  geoCityId: string,
  jbQ: JamBaseQuotaContext | undefined
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page <= VENUE_GEO_CITY_MAX_PAGES; page++) {
    const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
      apiKey,
      '/venues',
      { geoCityId, perPage: VENUES_PER_PAGE, page: String(page) },
      jbQ
    );
    const batch = data?.venues ?? [];
    if (batch.length === 0) break;
    for (const v of batch) out.push(v as Record<string, unknown>);
    if (batch.length < parseInt(VENUES_PER_PAGE, 10)) break;
  }
  return out;
}

/**
 * JamBase v3 `/venues` requires `venueName` or geo filters — use lat/lon + radius (mi), not zipCode.
 * @see https://data.jambase.com/openapi.json searchVenues
 */
async function fetchVenuesPaginatedByLatLon(
  apiKey: string,
  userLat: number,
  userLon: number,
  radiusMiles: number,
  jbQ: JamBaseQuotaContext | undefined
): Promise<{
  venues: Record<string, unknown>[];
  /** First `/venues` page failed (null) — JamBase unreachable, auth, quota mid-flight, etc. */
  firstPageFailed: boolean;
  firstPageFailure?: JamBaseFetchDiag['failure'];
  firstPageHttpStatus?: number;
}> {
  const searchMiles = Math.max(
    radiusMiles + VENUE_JAMBASE_SEARCH_BUFFER_MILES,
    VENUE_JAMBASE_SEARCH_MIN_MILES
  );
  const radiusAmount = Math.min(5000, Math.max(1, Math.ceil(searchMiles)));
  const out: Record<string, unknown>[] = [];
  let firstPageFailed = false;
  const firstDiag: JamBaseFetchDiag = {};
  for (let page = 1; page <= VENUE_GEO_CITY_MAX_PAGES; page++) {
    const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
      apiKey,
      '/venues',
      {
        geoLatitude: String(userLat),
        geoLongitude: String(userLon),
        geoRadiusAmount: String(radiusAmount),
        geoRadiusUnits: 'mi',
        perPage: VENUES_PER_PAGE,
        page: String(page),
      },
      jbQ,
      page === 1 ? firstDiag : undefined
    );
    if (data == null) {
      if (page === 1) {
        firstPageFailed = true;
      }
      break;
    }
    const batch = data?.venues ?? [];
    if (batch.length === 0) break;
    for (const v of batch) out.push(v as Record<string, unknown>);
    if (batch.length < parseInt(VENUES_PER_PAGE, 10)) break;
  }
  return {
    venues: out,
    firstPageFailed,
    firstPageFailure: firstPageFailed ? firstDiag.failure : undefined,
    firstPageHttpStatus: firstPageFailed ? firstDiag.httpStatus : undefined,
  };
}

/** User-facing copy when the first geo `/venues` JamBase call returns null (see `JamBaseFetchDiag`). */
function jamBaseVenueFetchFailureNotice(
  failure?: JamBaseFetchDiag['failure'],
  httpStatus?: number
): string {
  switch (failure) {
    case 'missing_key':
      return 'JamBase API key is missing on the worker. Set JAMBASE_API_KEY in .dev.vars (local) or Wrangler secrets (production).';
    case 'quota':
      return 'JamBase was blocked by JAMBASE_QUOTA_ENFORCEMENT (call budget used up). For local dev set JAMBASE_QUOTA_ENFORCEMENT=0 or raise JAMBASE_QUOTA_MAX in .dev.vars.';
    case 'http':
      if (httpStatus === 401 || httpStatus === 403) {
        return `JamBase rejected the API key (HTTP ${httpStatus}). Use your JamBase Data API v3 key from https://data.jambase.com — paste it as JAMBASE_API_KEY with no quotes or spaces.`;
      }
      if (httpStatus === 429) {
        return 'JamBase rate-limited the request (HTTP 429) after automatic retries. Wait a minute and try again, or check your JamBase plan limits.';
      }
      return `JamBase returned HTTP ${httpStatus ?? 'error'}. Open worker logs for the response snippet. GPS was still received.`;
    case 'non_json':
      return 'JamBase did not return JSON (often a proxy/HTML error page). Confirm `npm run dev:api` is running if Vite proxies /api to port 8787, and that JAMBASE_API_KEY is set.';
    case 'api_error':
      return 'JamBase responded with success: false (bad parameters or account issue). Check worker logs for json.errors.';
    case 'network':
      return 'Could not reach api.data.jambase.com from the worker (network or TLS). Try again; if local, check firewall/VPN.';
    default:
      return 'JamBase venue lookup failed before returning data. Check worker logs and JAMBASE_API_KEY / JAMBASE_QUOTA_ENFORCEMENT in .dev.vars.';
  }
}

/**
 * POST /api/clips/resolve-show
 * Body: { latitude, longitude, at? (ISO; used for event fallback window only), city?, state?, country? }
 *
 * Picks the **closest** JamBase venue (or deduped event row) within the computed match radius.
 * When multiple venues are nearby, **`match` is always `single`** — the geographically closest candidate wins;
 * users are not asked to disambiguate in the picker flow.
 */
export async function postResolveShowForClip(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const key = c.env.JAMBASE_API_KEY;
  if (!key?.trim()) {
    await recordResolveTelemetry(
      c,
      mochaUser.id,
      'none',
      50,
      0,
      0,
      null,
      'missing_jambase_key',
      'JamBase is not configured'
    );
    return c.json({
      match: 'none' as const,
      candidates: [] as ClipShowCandidate[],
      nearbyVenues: [] as ClipShowCandidate[],
      notice: 'JamBase is not configured',
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  const atRaw = typeof body.at === 'string' ? body.at : '';
  const atMs = Date.parse(atRaw);
  const hasAt = Number.isFinite(atMs);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return c.json({ error: 'latitude and longitude are required' }, 400);
  }

  let city = typeof body.city === 'string' ? body.city.trim() : '';
  let countryIso = typeof body.country === 'string' ? body.country.trim().toUpperCase() : 'US';
  if (countryIso.length !== 2) countryIso = 'US';

  let postcode: string | null = null;
  const rev = await nominatimReverse(lat, lon);
  if (rev) {
    if (!city && rev.city) city = rev.city;
    if (rev.country_code) countryIso = rev.country_code;
    if (rev.postcode) postcode = rev.postcode;
  }

  const profile = (await c.env.DB.prepare(
    `SELECT location_radius_miles FROM user_profiles WHERE mocha_user_id = ?`
  )
    .bind(mochaUser.id)
    .first()) as { location_radius_miles: number | null } | null;

  /** Stored preference (feed, etc.). */
  const profileRadiusMiles = Math.max(1, Number(profile?.location_radius_miles) || 50);
  /** JamBase resolve / venue–GPS comparison never uses a tighter disk than this. */
  const matchRadiusMiles = Math.max(profileRadiusMiles, VENUE_MATCH_RADIUS_FLOOR_MILES);

  const jbQ = jamBaseQuotaFromEnv(c.env);
  if (jbQ && !(await jamBaseQuotaPrecheck(jbQ))) {
    await recordResolveTelemetry(
      c,
      mochaUser.id,
      'none',
      profileRadiusMiles,
      0,
      0,
      null,
      'jambase_quota',
      'JamBase quota exceeded'
    );
    return c.json({
      match: 'none' as const,
      candidates: [] as ClipShowCandidate[],
      nearbyVenues: [] as ClipShowCandidate[],
      notice:
        'JamBase is unavailable right now because the workspace API call quota was reached. For local dev, turn off JAMBASE_QUOTA_ENFORCEMENT or raise JAMBASE_QUOTA_MAX in .dev.vars, then retry.',
      meta: {
        radiusMiles: profileRadiusMiles,
        matchRadiusMiles,
        city,
        postcode,
        geoCityId: null,
        geoCityIds: [],
        postcodeFromNominatim: Boolean(postcode),
        venuesLatLonSearch: true,
        rawVenueCount: 0,
        matchedVenueCount: 0,
        eventDateFrom: new Date().toISOString().split('T')[0],
        matchSource: 'quota',
        lat,
        lon,
        jamBaseQuotaBlocked: true,
      },
    });
  }

  const userCityLower = city ? city.toLowerCase() : null;

  const seenVenueKeys = new Set<string>();
  const rawVenueList: Record<string, unknown>[] = [];
  /** Lat/lon + geoIp JamBase listings: trust rows without precise coords when city is unknown. */
  const trustedGeoVenueIds = new Set<string>();

  const pushVenueBatch = (venues: Record<string, unknown>[], markTrusted: boolean) => {
    for (const v of venues) {
      const id = venueRootIdentifier(v) ?? '';
      if (!id || seenVenueKeys.has(id)) continue;
      seenVenueKeys.add(id);
      rawVenueList.push(v);
      if (markTrusted) trustedGeoVenueIds.add(id);
    }
  };

  const latLonRes = await fetchVenuesPaginatedByLatLon(key, lat, lon, profileRadiusMiles, jbQ);
  pushVenueBatch(latLonRes.venues, true);

  if (rawVenueList.length === 0 && !latLonRes.firstPageFailed) {
    const cfIp =
      c.req.header('cf-connecting-ip') ||
      c.req.header('CF-Connecting-IP') ||
      (typeof c.req.header('x-forwarded-for') === 'string'
        ? c.req.header('x-forwarded-for')!.split(',')[0]!.trim()
        : '');
    if (cfIp.length > 5) {
      const ipData = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
        key,
        '/venues',
        {
          geoIp: cfIp,
          perPage: VENUES_PER_PAGE,
          page: '1',
        },
        jbQ
      );
      if (ipData != null) {
        pushVenueBatch((ipData.venues ?? []) as Record<string, unknown>[], true);
      }
    }
  }

  /** Only when lat/lon (+ IP) returned nothing — avoids extra JamBase calls when geo search already succeeded. */
  let geoCityIds: string[] = [];
  let primaryGeoCityId: string | null = null;
  if (rawVenueList.length === 0) {
    geoCityIds = city ? await resolveGeoCityIds(key, city, countryIso, jbQ, 4) : [];
    primaryGeoCityId = geoCityIds[0] ?? null;
    for (const gcid of geoCityIds) {
      pushVenueBatch(await fetchVenuesPaginatedByGeoCity(key, gcid, jbQ), false);
    }
    if (rawVenueList.length === 0 && geoCityIds.length === 0) {
      const metroPayload = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
        key,
        '/venues',
        { geoMetroId: 'jambase:1', perPage: VENUES_PER_PAGE, page: '1' },
        jbQ
      );
      pushVenueBatch((metroPayload?.venues ?? []) as Record<string, unknown>[], false);
    }
  }

  const fromVenues: ClipShowCandidate[] = [];
  for (const v of rawVenueList) {
    const vid = venueRootIdentifier(v) ?? '';
    const cnd = candidateFromVenue(v, lat, lon, matchRadiusMiles, userCityLower, {
      trustJamBaseGeoList: trustedGeoVenueIds.has(vid),
    });
    if (cnd) fromVenues.push(cnd);
  }

  if (fromVenues.length === 0) {
    for (const v of rawVenueList) {
      const vid = venueRootIdentifier(v) ?? '';
      if (!vid || !trustedGeoVenueIds.has(vid)) continue;
      const salvage = soleRawVenueCandidate(v, lat, lon);
      if (salvage) fromVenues.push(salvage);
    }
  }

  let matchSource: 'venues' | 'events' = 'venues';
  let rawUpstreamCount = rawVenueList.length;
  let working = dedupeKeepClosestPerVenue(fromVenues);

  if (working.length === 0 && rawVenueList.length === 1) {
    const sole = soleRawVenueCandidate(rawVenueList[0]!, lat, lon);
    if (sole) {
      working = dedupeKeepClosestPerVenue([sole]);
    }
  }

  if (working.length === 0) {
    matchSource = 'events';
    const anchor = hasAt ? new Date(atMs) : new Date();
    const from = new Date(anchor);
    from.setUTCDate(from.getUTCDate() - 1);
    const eventDateFrom = from.toISOString().split('T')[0];

    const eventSearchMiles = Math.max(
      profileRadiusMiles + VENUE_JAMBASE_SEARCH_BUFFER_MILES,
      VENUE_JAMBASE_SEARCH_MIN_MILES
    );
    const eventRadius = Math.min(5000, Math.max(1, Math.ceil(eventSearchMiles + GPS_DISTANCE_SLACK_MILES)));
    /** Prefer GPS radius over city/metro so fallback matches the same coordinates as venue search. */
    const eventParams: Record<string, string> = {
      eventDateFrom,
      perPage: '80',
      page: '1',
      geoLatitude: String(lat),
      geoLongitude: String(lon),
      geoRadiusAmount: String(eventRadius),
      geoRadiusUnits: 'mi',
    };

    const data = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(key, '/events', eventParams, jbQ);
    const rawEvents = data?.events ?? [];
    rawUpstreamCount = rawEvents.length;

    const fromEvents: ClipShowCandidate[] = [];
    for (const ev of rawEvents) {
      const cnd = candidateFromEvent(ev, lat, lon, matchRadiusMiles, userCityLower, {
        trustJamBaseGeoList: true,
      });
      if (cnd) fromEvents.push(cnd);
    }
    working = dedupeKeepClosestPerVenue(fromEvents);
  }

  const { match, candidates } = finalizeMatch(working);
  const nearbyVenues = working.slice(0, 15);

  const notice =
    match === 'none'
      ? latLonRes.firstPageFailed
        ? jamBaseVenueFetchFailureNotice(latLonRes.firstPageFailure, latLonRes.firstPageHttpStatus)
        : rawVenueList.length === 0
          ? 'JamBase returned no venues for this latitude and longitude. You can enter the venue manually.'
          : 'JamBase returned nearby venues, but none could be matched to your coordinates. You can pick the venue manually.'
      : null;

  await recordResolveTelemetry(
    c,
    mochaUser.id,
    match,
    profileRadiusMiles,
    rawUpstreamCount,
    candidates.length,
    primaryGeoCityId,
    matchSource === 'venues' ? 'venues_geo' : 'events_fallback',
    notice
  );

  c.header('Cache-Control', 'private, max-age=60');

  const anchor = hasAt ? new Date(atMs) : new Date();
  const from = new Date(anchor);
  from.setUTCDate(from.getUTCDate() - 1);
  const eventDateFrom = from.toISOString().split('T')[0];

  return c.json({
    match,
    candidates,
    nearbyVenues,
    notice,
    meta: {
      radiusMiles: profileRadiusMiles,
      matchRadiusMiles,
      city,
      postcode,
      geoCityId: primaryGeoCityId,
      geoCityIds,
      postcodeFromNominatim: Boolean(postcode),
      venuesLatLonSearch: true,
      rawVenueCount: rawVenueList.length,
      matchedVenueCount: fromVenues.length,
      eventDateFrom,
      matchSource,
      lat,
      lon,
      jamBaseVenueFirstFetchFailed: latLonRes.firstPageFailed,
      jamBaseVenueFirstFetchFailure: latLonRes.firstPageFailure ?? null,
      jamBaseVenueFirstFetchHttpStatus: latLonRes.firstPageHttpStatus ?? null,
    },
  });
}
