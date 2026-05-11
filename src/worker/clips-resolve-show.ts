import type { Context } from 'hono';
import { jamBaseFetch, jamBaseQuotaFromEnv, type JamBaseQuotaContext } from './jambase-client';
import { headlinerFromEvent } from './jambase-map';

const SHOW_PAD_MS = 3 * 60 * 60 * 1000;
const DEFAULT_END_AFTER_START_MS = 4 * 60 * 60 * 1000;

export type ClipShowCandidate = {
  jambase_event_id: string;
  jambase_artist_id: string | null;
  jambase_venue_id: string | null;
  artist_name: string | null;
  venue_name: string | null;
  location: string | null;
  startDate: string;
  distance_miles: number | null;
};

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
    // Telemetry should never break upload flow.
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
  if (!loc) return null;
  const geo = loc.geo as Record<string, unknown> | undefined;
  if (geo) {
    const lat = Number(geo.latitude);
    const lon = Number(geo.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const lat = Number(loc.latitude);
  const lon = Number(loc.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
}

function venueCityStateLine(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  const addr = loc?.address as Record<string, unknown> | undefined;
  const city = typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const st =
    typeof region?.alternateName === 'string'
      ? region.alternateName
      : typeof region?.name === 'string'
        ? (region.name as string)
        : '';
  const line = [city, st].filter(Boolean).join(', ');
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
): Promise<{ city: string | null; state: string | null; country_code: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Momentum/1.0 (https://github.com/)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    const address = data.address || {};
    const city = address.city || address.town || address.village || null;
    const state = address.state || null;
    const country_code = address.country_code ? address.country_code.toUpperCase() : null;
    return { city, state, country_code };
  } catch (e) {
    console.error('Nominatim reverse failed:', e);
    return null;
  }
}

function eventWindowBounds(
  ev: Record<string, unknown>
): { start: number; end: number } | null {
  const startRaw = ev.startDate;
  if (typeof startRaw !== 'string') return null;
  const start = Date.parse(startRaw);
  if (!Number.isFinite(start)) return null;

  let end: number;
  const endRaw = ev.endDate;
  if (typeof endRaw === 'string') {
    const p = Date.parse(endRaw);
    end = Number.isFinite(p) ? p : start + DEFAULT_END_AFTER_START_MS;
  } else {
    end = start + DEFAULT_END_AFTER_START_MS;
  }

  return { start: start - SHOW_PAD_MS, end: end + SHOW_PAD_MS };
}

function clipTimeInEventWindow(atMs: number, ev: Record<string, unknown>): boolean {
  const w = eventWindowBounds(ev);
  if (!w) return false;
  return atMs >= w.start && atMs <= w.end;
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
    withinRadius = distanceMiles <= radiusMiles;
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

async function resolveGeoCityId(
  apiKey: string,
  city: string,
  countryIso2: string,
  jbQ: JamBaseQuotaContext | undefined
): Promise<string | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;
  const cities = await jamBaseFetch<{ cities?: Record<string, unknown>[] }>(
    apiKey,
    '/geographies/cities',
    {
      geoCityName: trimmed,
      geoCountryIso2: countryIso2.slice(0, 2).toUpperCase(),
    },
    jbQ
  );
  const first = cities?.cities?.[0];
  return typeof first?.identifier === 'string' ? first.identifier : null;
}

/**
 * POST /api/clips/resolve-show
 * Body: { latitude, longitude, at, city?, state?, country? }
 * Uses user_profiles.location_radius_miles (default 50).
 *
 * Candidates are events in the time window that fall within radius (or city heuristics).
 * They are ordered with the venue nearest to (latitude, longitude) first so the primary
 * pick and jambase_venue_id align with closest physical venue, then recording time.
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

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(atMs)) {
    return c.json({ error: 'latitude, longitude, and valid ISO at are required' }, 400);
  }

  let city = typeof body.city === 'string' ? body.city.trim() : '';
  let countryIso = typeof body.country === 'string' ? body.country.trim().toUpperCase() : 'US';
  if (countryIso.length !== 2) countryIso = 'US';

  if (!city) {
    const rev = await nominatimReverse(lat, lon);
    if (rev?.city) city = rev.city;
    if (rev?.country_code) countryIso = rev.country_code;
  }

  const profile = (await c.env.DB.prepare(
    `SELECT location_radius_miles FROM user_profiles WHERE mocha_user_id = ?`
  )
    .bind(mochaUser.id)
    .first()) as { location_radius_miles: number | null } | null;

  const radiusMiles = Math.max(1, Number(profile?.location_radius_miles) || 50);

  const jbQ = jamBaseQuotaFromEnv(c.env);
  const geoCityId = city ? await resolveGeoCityId(key, city, countryIso, jbQ) : null;

  const atDate = new Date(atMs);
  const from = new Date(atDate);
  from.setUTCDate(from.getUTCDate() - 1);
  const eventDateFrom = from.toISOString().split('T')[0];

  const params: Record<string, string> = {
    eventDateFrom,
    perPage: '60',
    page: '1',
  };
  if (geoCityId) {
    params.geoCityId = geoCityId;
  } else {
    params.geoMetroId = 'jambase:1';
  }

  const data = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(key, '/events', params, jbQ);
  const rawEvents = data?.events ?? [];

  const userCityLower = city ? city.toLowerCase() : null;

  const candidates: ClipShowCandidate[] = [];
  for (const ev of rawEvents) {
    if (!clipTimeInEventWindow(atMs, ev)) continue;
    const cnd = candidateFromEvent(ev, lat, lon, radiusMiles, userCityLower);
    if (cnd) candidates.push(cnd);
  }

  // Prefer the venue closest to the user's coordinates so clips.jambase_venue_id reflects
  // geographic association; time-to-show is a tiebreaker (same venue / city-only rows).
  candidates.sort((a, b) => {
    const da = a.distance_miles;
    const db = b.distance_miles;
    const aGeo = da != null && Number.isFinite(da);
    const bGeo = db != null && Number.isFinite(db);
    if (aGeo && bGeo && da !== db) return da - db;
    if (aGeo && !bGeo) return -1;
    if (!aGeo && bGeo) return 1;
    const ta = Math.abs(Date.parse(a.startDate) - atMs);
    const tb = Math.abs(Date.parse(b.startDate) - atMs);
    return ta - tb;
  });

  let match: ClipResolveMatch;
  if (candidates.length === 0) match = 'none';
  else if (candidates.length === 1) match = 'single';
  else match = 'ambiguous';

  const notice =
    match === 'none'
      ? 'No matching show found in your current time window and radius. You can enter details manually.'
      : null;

  await recordResolveTelemetry(
    c,
    mochaUser.id,
    match,
    radiusMiles,
    rawEvents.length,
    candidates.length,
    geoCityId,
    geoCityId ? 'geo_city_id' : 'metro_fallback',
    notice
  );

  c.header('Cache-Control', 'private, max-age=60');

  return c.json({
    match,
    candidates,
    notice,
    meta: {
      radiusMiles,
      geoCityId,
      eventDateFrom,
    },
  });
}
