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
import { artistAtVenueTitle, jamBaseEventTitle } from '../shared/event-title';
import {
  jamBaseEventMatchesCapture,
  jamBaseVenueTimezone,
  JAMBASE_EVENT_IN_SHOW_LOOKBACK_HOURS,
} from '../shared/jambase-event-day';
import {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  NEARBY_VENUE_PICKER_COUNT,
  resolveShowMatchFromCandidates,
} from '../shared/clip-resolve-show-match';
import { loadGoingShowMarksForUser } from './user-show-marks-endpoints';

export {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  NEARBY_VENUE_PICKER_COUNT,
  canAutoApplyCandidate,
} from '../shared/clip-resolve-show-match';

/** Extra miles beyond profile radius so GPS jitter does not drop the venue you are standing in front of. */
const GPS_DISTANCE_SLACK_MILES = 1.25;

/** JamBase geo `/events` search uses at least this many miles so sparse areas still return rows. */
const VENUE_JAMBASE_SEARCH_MIN_MILES = 35;

/** Optional JamBase radius beyond profile radius when calling `/events` geo search. */
const VENUE_JAMBASE_SEARCH_BUFFER_MILES = 25;

/** Never match tighter than this when comparing GPS ↔ venue coords (profile can be 1–5 mi). */
const VENUE_MATCH_RADIUS_FLOOR_MILES = 35;

/** Max closest venues to scan for a same-day JamBase show (expandPastEvents per venue). */
const MAX_VENUES_TO_SCAN = 20;

/** Include in-progress / recently started shows on venue-scoped event lookups. */
export const IN_SHOW_EXPAND_PAST_HOURS = JAMBASE_EVENT_IN_SHOW_LOOKBACK_HOURS;

type CandidateGeoTrust = { trustJamBaseGeoList?: boolean };

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

function venueIdentifierFromEvent(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.identifier === 'string' ? loc.identifier : null;
}

function candidateFromJamBaseEvent(
  ev: Record<string, unknown>,
  userLat: number,
  userLon: number,
  matchRadiusMiles: number,
  captureMs: number,
): ClipShowCandidate | null {
  if (!jamBaseEventMatchesCapture(ev, captureMs, userLat, userLon)) return null;

  const eventId = typeof ev.identifier === 'string' ? ev.identifier : null;
  if (!eventId) return null;

  const head = headlinerFromEvent(ev);
  const artistName = typeof head?.name === 'string' ? head.name : null;
  const artistId = typeof head?.identifier === 'string' ? head.identifier : null;
  const venueName = venueNameFromEvent(ev);
  const venueId = venueIdentifierFromEvent(ev);
  const locationLine = venueCityStateLine(ev);
  const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';
  const eventTitle = jamBaseEventTitle(ev) ?? artistAtVenueTitle(artistName, venueName);

  const coords = extractVenueCoords(ev);
  let distanceMiles: number | null = null;
  if (coords) {
    distanceMiles = haversineMiles(userLat, userLon, coords.lat, coords.lon);
    if (distanceMiles > matchRadiusMiles + GPS_DISTANCE_SLACK_MILES) return null;
  }

  if (!venueName && !venueId) return null;

  return {
    jambase_event_id: eventId,
    jambase_artist_id: artistId,
    jambase_venue_id: venueId,
    artist_name: artistName,
    venue_name: venueName,
    location: locationLine,
    event_title: eventTitle,
    startDate,
    distance_miles: distanceMiles,
    venue_timezone: jamBaseVenueTimezone(ev, userLat, userLon),
  };
}

/**
 * Geo `/events` cannot use `expandPastEvents` unless combined with `venueId` or `artistId`. If
 * `eventDateFrom` is before UTC "today", JamBase responds with HTTP 400.
 */
function jamBaseGeoEventDateFromUtc(anchorMs: number): string {
  const todayUtc = new Date().toISOString().split('T')[0];
  const win = new Date(anchorMs);
  win.setUTCDate(win.getUTCDate() - 1);
  const tentative = win.toISOString().split('T')[0];
  return tentative < todayUtc ? todayUtc : tentative;
}

/** Include past rows when the window starts before today (requires plan support). */
function jamBaseVenueEventsQueryParams(
  venueId: string,
  captureMs: number,
): Record<string, string> {
  const win = new Date(captureMs);
  win.setUTCDate(win.getUTCDate() - 1);
  const eventDateFrom = win.toISOString().split('T')[0];
  return {
    venueId,
    eventDateFrom,
    perPage: '50',
    page: '1',
    expandPastEvents: 'true',
  };
}

function pickClosestEventToCapture(
  events: Record<string, unknown>[],
  captureMs: number,
): Record<string, unknown> | null {
  if (events.length === 0) return null;
  let bestEv = events[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const ev of events) {
    const sd = typeof ev.startDate === 'string' ? ev.startDate : '';
    const t = Date.parse(sd);
    const score = Number.isFinite(t) ? Math.abs(t - captureMs) : Number.POSITIVE_INFINITY;
    if (score < bestScore) {
      bestScore = score;
      bestEv = ev;
    }
  }
  return bestEv;
}

function mergeEventIntoVenueCandidate(
  base: ClipShowCandidate,
  bestEv: Record<string, unknown>,
  userLat: number,
  userLon: number,
): ClipShowCandidate {
  const head = headlinerFromEvent(bestEv);
  const artistName = typeof head?.name === 'string' ? head.name : null;
  const artistId = typeof head?.identifier === 'string' ? head.identifier : null;
  const eventId = typeof bestEv.identifier === 'string' ? bestEv.identifier : null;
  const startDate = typeof bestEv.startDate === 'string' ? bestEv.startDate : '';
  const vName = venueNameFromEvent(bestEv);
  const locLine = venueCityStateLine(bestEv);
  const eventTitle =
    jamBaseEventTitle(bestEv) ?? artistAtVenueTitle(artistName, base.venue_name ?? vName);

  return {
    ...base,
    jambase_event_id: eventId,
    jambase_artist_id: artistId,
    artist_name: artistName,
    venue_name: base.venue_name ?? vName,
    location: base.location ?? locLine,
    event_title: eventTitle,
    startDate,
    venue_timezone: jamBaseVenueTimezone(bestEv, userLat, userLon),
  };
}

/**
 * Load shows at a venue. Prefer same capture-day listings; fall back to in-show time window,
 * then venue-only when JamBase lists any event (closed / inactive venues excluded).
 */
async function enrichWithSameDayShowAtVenue(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  base: ClipShowCandidate,
  captureMs: number,
  userLat: number,
  userLon: number,
): Promise<ClipShowCandidate | null> {
  const venueId = base.jambase_venue_id?.trim();

  if (!venueId) return null;

  const data = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
    apiKey,
    '/events',
    jamBaseVenueEventsQueryParams(venueId, captureMs),
    jbQ
  );
  const raw = data?.events ?? [];
  if (raw.length === 0) return null;

  const sameDay: Record<string, unknown>[] = [];
  for (const ev of raw) {
    if (typeof ev !== 'object' || ev === null) continue;
    const evo = ev as Record<string, unknown>;
    if (jamBaseEventMatchesCapture(evo, captureMs, userLat, userLon)) sameDay.push(evo);
  }

  if (sameDay.length > 0) {
    const bestEv = pickClosestEventToCapture(sameDay, captureMs);
    if (bestEv) return mergeEventIntoVenueCandidate(base, bestEv, userLat, userLon);
  }

  return null;
}

function venueNameFromJamBaseVenue(venue: Record<string, unknown>): string | null {
  return typeof venue.name === 'string' ? venue.name : null;
}

function venueIdFromJamBaseVenue(venue: Record<string, unknown>): string | null {
  return typeof venue.identifier === 'string' ? venue.identifier : null;
}

function candidateFromJamBaseVenue(
  venue: Record<string, unknown>,
  userLat: number,
  userLon: number,
  matchRadiusMiles: number,
  userCityLower: string | null,
  opts?: CandidateGeoTrust,
): ClipShowCandidate | null {
  const venueId = venueIdFromJamBaseVenue(venue);
  const venueName = venueNameFromJamBaseVenue(venue);
  if (!venueId || !venueName) return null;

  const locationLine = venueCityStateLine(venue);
  const coords = extractVenueCoords(venue);
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

  return {
    jambase_event_id: null,
    jambase_artist_id: null,
    jambase_venue_id: venueId,
    artist_name: null,
    venue_name: venueName,
    location: locationLine,
    event_title: null,
    startDate: '',
    distance_miles: distanceMiles,
  };
}

/** User-facing copy when a JamBase call returns null (see `JamBaseFetchDiag`). */
function jamBaseFetchFailureNotice(
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
      return 'JamBase event lookup failed before returning data. Check worker logs and JAMBASE_API_KEY / JAMBASE_QUOTA_ENFORCEMENT in .dev.vars.';
  }
}

/**
 * POST /api/clips/resolve-show
 * Body: { latitude, longitude, at? (ISO; capture instant for same-day show + artist merge), city?, state?, country? }
 *
 * **Venues with shows only** — geo `/venues` for physical proximity, then `/events?venueId=…&expandPastEvents`
 * to keep venues that have a JamBase show on the capture **UTC calendar day** (includes in-progress shows
 * within {@link IN_SHOW_EXPAND_PAST_HOURS}h). Closed venues with no listings are skipped.
 * Auto-applies when ≤ {@link AUTO_APPLY_MAX_DISTANCE_MILES} mi, or when a same-date "going"
 * show mark matches a nearby candidate; otherwise returns top {@link NEARBY_VENUE_PICKER_COUNT}
 * venues with tonight's shows for manual pick.
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

  let postcode: string | null = null;
  const rev = await nominatimReverse(lat, lon);
  if (rev) {
    if (!city && rev.city) city = rev.city;
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
        eventsGeoSearch: false,
        rawEventCount: 0,
        matchedEventCandidateCount: 0,
        eventDateFrom: new Date().toISOString().split('T')[0],
        matchSource: 'quota',
        lat,
        lon,
        jamBaseQuotaBlocked: true,
      },
    });
  }

  const userCityLower = city ? city.toLowerCase() : null;

  const resolveAnchorMs = hasAt ? atMs : Date.now();
  const eventDateFrom = jamBaseGeoEventDateFromUtc(resolveAnchorMs);

  const venueSearchMiles = Math.max(
    profileRadiusMiles + VENUE_JAMBASE_SEARCH_BUFFER_MILES,
    VENUE_JAMBASE_SEARCH_MIN_MILES,
  );
  const venueRadius = Math.min(
    5000,
    Math.max(1, Math.ceil(venueSearchMiles + GPS_DISTANCE_SLACK_MILES)),
  );

  const venueParams: Record<string, string> = {
    perPage: '40',
    page: '1',
    geoLatitude: String(lat),
    geoLongitude: String(lon),
    geoRadiusAmount: String(venueRadius),
    geoRadiusUnits: 'mi',
  };

  const venuesDiag: JamBaseFetchDiag = {};
  const geoVenuesPayload = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
    key,
    '/venues',
    venueParams,
    jbQ,
    venuesDiag,
  );

  const venuesFetchFailed = geoVenuesPayload == null;
  const rawVenues = geoVenuesPayload?.venues ?? [];
  const rawUpstreamCount = rawVenues.length;

  const matchSource = 'venues_geo' as const;

  const fromVenues: ClipShowCandidate[] = [];
  for (const venue of rawVenues) {
    if (typeof venue !== 'object' || venue === null) continue;
    const cnd = candidateFromJamBaseVenue(
      venue as Record<string, unknown>,
      lat,
      lon,
      matchRadiusMiles,
      userCityLower,
      { trustJamBaseGeoList: true },
    );
    if (cnd) fromVenues.push(cnd);
  }

  const eventParams: Record<string, string> = {
    eventDateFrom,
    perPage: '40',
    page: '1',
    geoLatitude: String(lat),
    geoLongitude: String(lon),
    geoRadiusAmount: String(venueRadius),
    geoRadiusUnits: 'mi',
  };
  const eventsDiag: JamBaseFetchDiag = {};
  const geoEventsPayload = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
    key,
    '/events',
    eventParams,
    jbQ,
    eventsDiag,
  );

  const fromEvents: ClipShowCandidate[] = [];
  for (const ev of geoEventsPayload?.events ?? []) {
    if (typeof ev !== 'object' || ev === null) continue;
    const cnd = candidateFromJamBaseEvent(
      ev as Record<string, unknown>,
      lat,
      lon,
      matchRadiusMiles,
      resolveAnchorMs,
    );
    if (cnd) fromEvents.push(cnd);
  }

  const working = dedupeKeepClosestPerVenue([...fromVenues, ...fromEvents]);
  const toScan = working.slice(0, MAX_VENUES_TO_SCAN);

  let enrichedSorted: ClipShowCandidate[] = [];
  if (toScan.length > 0) {
    const enrichedResults = await Promise.allSettled(
      toScan.map(async (base) => {
        if (base.jambase_event_id) return base;
        return enrichWithSameDayShowAtVenue(key, jbQ, base, resolveAnchorMs, lat, lon);
      }),
    );
    enrichedSorted = sortCandidatesByDistance(
      enrichedResults
        .filter(
          (r): r is PromiseFulfilledResult<ClipShowCandidate | null> => r.status === 'fulfilled',
        )
        .map((r) => r.value)
        .filter((r): r is ClipShowCandidate => r != null),
    );
    for (const r of enrichedResults) {
      if (r.status === 'rejected') {
        console.error('resolve-show venue show enrichment failed:', r.reason);
      }
    }
  }

  const goingMarks = await loadGoingShowMarksForUser(c.env.DB, mochaUser.id);
  const { match, candidates, nearbyVenues } = resolveShowMatchFromCandidates(
    enrichedSorted,
    goingMarks,
    resolveAnchorMs,
    lat,
    lon,
  );

  let notice: string | null = null;
  if (match === 'ambiguous') {
    notice =
      'Several venues with shows tonight are nearby — pick the one you are at.';
  } else if (match === 'none') {
    if (venuesFetchFailed) {
      notice = jamBaseFetchFailureNotice(venuesDiag.failure, venuesDiag.httpStatus);
    } else if (rawVenues.length === 0) {
      notice =
        'JamBase has no venues near this location. You can search for a venue manually below.';
    } else if (enrichedSorted.length === 0) {
      notice =
        'No JamBase shows tonight at venues near you (closed or inactive venues are skipped). Search for your venue manually.';
    } else {
      notice =
        'Shows tonight are farther than 2 miles from your location. Search for your venue manually.';
    }
  }

  await recordResolveTelemetry(
    c,
    mochaUser.id,
    match,
    profileRadiusMiles,
    rawUpstreamCount,
    candidates.length,
    null,
    matchSource,
    notice
  );

  c.header('Cache-Control', 'private, max-age=60');

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
      geoCityId: null,
      geoCityIds: [] as string[],
      postcodeFromNominatim: Boolean(postcode),
      eventsGeoSearch: true,
      venuesGeoSearch: true,
      rawVenueCount: rawVenues.length,
      rawEventCount: rawVenues.length,
      matchedEventCandidateCount: enrichedSorted.length,
      eventDateFrom,
      matchSource,
      lat,
      lon,
      jamBaseVenuesFetchFailed: venuesFetchFailed,
      jamBaseVenuesFetchFailure: venuesFetchFailed ? venuesDiag.failure ?? null : null,
      jamBaseVenuesFetchHttpStatus: venuesFetchFailed ? venuesDiag.httpStatus ?? null : null,
    },
  });
}
