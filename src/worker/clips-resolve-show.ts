import type { Context } from 'hono';
import { jamBaseFetch, jamBaseQuotaFromEnv, type JamBaseQuotaContext } from './jambase-client';
import { headlinerFromEvent } from './jambase-map';
import type { ClipShowCandidate } from '../shared/types';

/** If the second-closest venue is within this many miles of the closest, offer a disambiguation list. */
const VENUE_TIE_MILES = 0.35;

/** Extra miles beyond profile radius so GPS jitter does not drop the venue you are standing in front of. */
const GPS_DISTANCE_SLACK_MILES = 0.75;

const VENUES_PER_PAGE = '100';
const VENUE_GEO_CITY_MAX_PAGES = 5;

type ClipResolveMatch = 'none' | 'single' | 'ambiguous';

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
      const lat = Number(geo.latitude);
      const lon = Number(geo.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    const latLoc = Number(loc.latitude);
    const lonLoc = Number(loc.longitude);
    if (Number.isFinite(latLoc) && Number.isFinite(lonLoc)) return { lat: latLoc, lon: lonLoc };
  }
  const rootGeo = ev.geo as Record<string, unknown> | undefined;
  if (rootGeo) {
    const lat = Number(rootGeo.latitude);
    const lon = Number(rootGeo.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const rlat = Number(ev.latitude);
  const rlon = Number(ev.longitude);
  if (Number.isFinite(rlat) && Number.isFinite(rlon)) return { lat: rlat, lon: rlon };
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

/** Group tied rows that refer to the same real venue (same JamBase venue id, or same name+location when id missing). */
function venueIdentityKey(c: ClipShowCandidate): string {
  const id = c.jambase_venue_id?.trim();
  if (id) return `id:${id}`;
  const name = (c.venue_name ?? '').toLowerCase().trim();
  const loc = (c.location ?? '').toLowerCase().trim();
  return `nm:${name}|${loc}`;
}

/** When JamBase returns a single venue row for this search but strict radius/city filters reject it, still trust that hit. */
function soleRawVenueCandidate(
  v: Record<string, unknown>,
  userLat: number,
  userLon: number
): ClipShowCandidate | null {
  const venueId = typeof v.identifier === 'string' ? v.identifier : null;
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

function finalizeMatch(dedupedSorted: ClipShowCandidate[], radiusMiles: number): {
  match: ClipResolveMatch;
  candidates: ClipShowCandidate[];
} {
  if (dedupedSorted.length === 0) return { match: 'none', candidates: [] };
  const best = dedupedSorted[0]!;
  const second = dedupedSorted[1];
  const da = best.distance_miles;
  const db = second?.distance_miles;
  // Resolve ambiguity when multiple venues are plausible. Use a radius-relative
  // threshold so dense areas (small radii) don't require extremely close distances.
  const tieWindowMiles = Math.max(VENUE_TIE_MILES, Math.min(5, radiusMiles * 0.2));
  if (
    second &&
    da != null &&
    db != null &&
    Number.isFinite(da) &&
    Number.isFinite(db) &&
    db - da < tieWindowMiles
  ) {
    const tied = dedupedSorted.filter((c) => {
      const d = c.distance_miles;
      if (d == null || !Number.isFinite(d) || da == null) return false;
      return d - da < tieWindowMiles;
    });
    if (tied.length >= 2) {
      const identityKeys = new Set(tied.map(venueIdentityKey));
      if (identityKeys.size === 1) {
        const sortedTied = sortCandidatesByDistance(tied);
        return { match: 'single', candidates: [sortedTied[0]!] };
      }
      return { match: 'ambiguous', candidates: tied.slice(0, 8) };
    }
  }
  return { match: 'single', candidates: [best] };
}

function candidateFromVenue(
  v: Record<string, unknown>,
  userLat: number,
  userLon: number,
  radiusMiles: number,
  userCityLower: string | null
): ClipShowCandidate | null {
  const venueId = typeof v.identifier === 'string' ? v.identifier : null;
  const venueName = typeof v.name === 'string' ? v.name : null;
  if (!venueId) return null;

  const locationLine = venueCityStateLine(v);
  const coords = extractVenueCoords(v);
  let distanceMiles: number | null = null;
  let withinRadius = false;

  if (coords) {
    distanceMiles = haversineMiles(userLat, userLon, coords.lat, coords.lon);
    withinRadius = distanceMiles <= radiusMiles + GPS_DISTANCE_SLACK_MILES;
  } else if (userCityLower && locationLine) {
    const locLower = locationLine.toLowerCase();
    const venueCity = locationLine.split(',')[0]?.trim().toLowerCase() ?? '';
    withinRadius = venueCity === userCityLower || locLower.includes(userCityLower);
  } else {
    withinRadius = false;
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
  radiusMiles: number,
  userCityLower: string | null
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
    withinRadius = distanceMiles <= radiusMiles + GPS_DISTANCE_SLACK_MILES;
  } else if (userCityLower && locationLine) {
    const locLower = locationLine.toLowerCase();
    const venueCity = locationLine.split(',')[0]?.trim().toLowerCase() ?? '';
    withinRadius = venueCity === userCityLower || locLower.includes(userCityLower);
  } else {
    withinRadius = false;
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
): Promise<Record<string, unknown>[]> {
  const radiusAmount = Math.min(
    5000,
    Math.max(1, Math.ceil(radiusMiles + GPS_DISTANCE_SLACK_MILES))
  );
  const out: Record<string, unknown>[] = [];
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
 * POST /api/clips/resolve-show
 * Body: { latitude, longitude, at? (optional, ignored for matching), city?, state?, country? }
 *
 * Picks the JamBase **venue** closest to the user's coordinates within their profile radius.
 * No show-time filter: upcoming events in the area are only used as a fallback when
 * `/venues` returns no usable rows.
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

  const radiusMiles = Math.max(1, Number(profile?.location_radius_miles) || 50);

  const jbQ = jamBaseQuotaFromEnv(c.env);
  const geoCityIds = city ? await resolveGeoCityIds(key, city, countryIso, jbQ, 4) : [];
  const primaryGeoCityId = geoCityIds[0] ?? null;

  const userCityLower = city ? city.toLowerCase() : null;

  const seenVenueKeys = new Set<string>();
  const rawVenueList: Record<string, unknown>[] = [];
  const pushVenueBatch = (venues: Record<string, unknown>[]) => {
    for (const v of venues) {
      const id = typeof v.identifier === 'string' ? v.identifier : '';
      if (!id || seenVenueKeys.has(id)) continue;
      seenVenueKeys.add(id);
      rawVenueList.push(v);
    }
  };

  pushVenueBatch(await fetchVenuesPaginatedByLatLon(key, lat, lon, radiusMiles, jbQ));

  for (const gcid of geoCityIds) {
    pushVenueBatch(await fetchVenuesPaginatedByGeoCity(key, gcid, jbQ));
  }
  if (rawVenueList.length === 0 && geoCityIds.length === 0) {
    const metroPayload = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
      key,
      '/venues',
      { geoMetroId: 'jambase:1', perPage: VENUES_PER_PAGE, page: '1' },
      jbQ
    );
    pushVenueBatch((metroPayload?.venues ?? []) as Record<string, unknown>[]);
  }

  const fromVenues: ClipShowCandidate[] = [];
  for (const v of rawVenueList) {
    const cnd = candidateFromVenue(v, lat, lon, radiusMiles, userCityLower);
    if (cnd) fromVenues.push(cnd);
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

    const eventRadius = Math.min(5000, Math.max(1, Math.ceil(radiusMiles + GPS_DISTANCE_SLACK_MILES)));
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
      const cnd = candidateFromEvent(ev, lat, lon, radiusMiles, userCityLower);
      if (cnd) fromEvents.push(cnd);
    }
    working = dedupeKeepClosestPerVenue(fromEvents);
  }

  const { match, candidates } = finalizeMatch(working, radiusMiles);

  const notice =
    match === 'none'
      ? 'No JamBase venue found within your radius. You can enter details manually.'
      : null;

  await recordResolveTelemetry(
    c,
    mochaUser.id,
    match,
    radiusMiles,
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
    notice,
    meta: {
      radiusMiles,
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
    },
  });
}
