import type { MochaUser } from '@/shared/mocha-user';
import { mochaUserIdKey } from './mocha-user-id';

export type SearchGeoAnchor = {
  latitude: number;
  longitude: number;
  label: string;
  city: string | null;
  state: string | null;
  countryIso2: string;
  /** Lowercase tokens for clips.location text fallback (legacy rows without GPS). */
  locationTokens: string[];
};

const PLACE_GEO_TYPES = new Set([
  'locality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'postal_town',
  'sublocality',
  'colloquial_area',
  'neighborhood',
]);

const US_STATE_NAMES = new Set(
  [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
    'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
    'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
    'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
    'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
    'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
    'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
  ],
);

type GoogleGeocodeResult = {
  formatted_address?: string;
  types?: string[];
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function jamBaseRecordCoords(rec: Record<string, unknown>): { lat: number; lon: number } | null {
  const pair = (latRaw: unknown, lonRaw: unknown) => {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  };

  const direct = pair(rec.latitude, rec.longitude);
  if (direct) return direct;

  const geo = rec.geo;
  if (geo && typeof geo === 'object') {
    const g = geo as Record<string, unknown>;
    const fromGeo = pair(g.latitude, g.longitude) ?? pair(g.lat, g.lng);
    if (fromGeo) return fromGeo;
  }

  const addr = rec.address;
  if (addr && typeof addr === 'object') {
    const a = addr as Record<string, unknown>;
    const fromAddr = pair(a.latitude, a.longitude) ?? pair(a.lat, a.lng);
    if (fromAddr) return fromAddr;
    const addrGeo = a.geo;
    if (addrGeo && typeof addrGeo === 'object') {
      const g = addrGeo as Record<string, unknown>;
      return pair(g.latitude, g.longitude) ?? pair(g.lat, g.lng);
    }
  }

  const loc = rec.location;
  if (loc && typeof loc === 'object') {
    const l = loc as Record<string, unknown>;
    const fromLoc = pair(l.latitude, l.longitude) ?? pair(l.lat, l.lng);
    if (fromLoc) return fromLoc;
    const locGeo = l.geo;
    if (locGeo && typeof locGeo === 'object') {
      const g = locGeo as Record<string, unknown>;
      return pair(g.latitude, g.longitude) ?? pair(g.lat, g.lng);
    }
  }

  return null;
}

function component(
  components: GoogleGeocodeResult['address_components'],
  type: string,
): { long_name: string; short_name: string } | null {
  if (!components) return null;
  for (const c of components) {
    if (c.types?.includes(type)) {
      const long_name = typeof c.long_name === 'string' ? c.long_name.trim() : '';
      const short_name = typeof c.short_name === 'string' ? c.short_name.trim() : '';
      if (long_name || short_name) return { long_name, short_name };
    }
  }
  return null;
}

function buildLocationTokens(
  query: string,
  city: string | null,
  state: { long_name: string; short_name: string } | null,
  label: string,
): string[] {
  const tokens = new Set<string>();
  const add = (value: string | null | undefined) => {
    const v = value?.trim().toLowerCase();
    if (v && v.length >= 2) tokens.add(v);
  };

  add(query);
  add(city);
  add(state?.long_name);
  add(state?.short_name);
  for (const part of label.split(',')) add(part);

  return [...tokens];
}

function geocodeResultToAnchor(query: string, result: GoogleGeocodeResult): SearchGeoAnchor | null {
  const types = result.types ?? [];
  if (!types.some((t) => PLACE_GEO_TYPES.has(t))) return null;
  if (types.includes('establishment') && !types.includes('locality')) return null;

  const lat = Number(result.geometry?.location?.lat);
  const lon = Number(result.geometry?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const cityComp =
    component(result.address_components, 'locality') ??
    component(result.address_components, 'postal_town') ??
    component(result.address_components, 'sublocality');
  const stateComp = component(result.address_components, 'administrative_area_level_1');
  const countryComp = component(result.address_components, 'country');

  const city = cityComp?.long_name || null;
  const state = stateComp?.long_name || null;
  const countryIso2 = (countryComp?.short_name || 'US').toUpperCase();
  const label =
    typeof result.formatted_address === 'string' && result.formatted_address.trim()
      ? result.formatted_address.trim()
      : query.trim();

  return {
    latitude: lat,
    longitude: lon,
    label,
    city,
    state,
    countryIso2,
    locationTokens: buildLocationTokens(query, city, stateComp, label),
  };
}

function heuristicGeoAnchor(query: string): SearchGeoAnchor | null {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  const lower = trimmed.toLowerCase();
  if (US_STATE_NAMES.has(lower)) {
    return {
      latitude: NaN,
      longitude: NaN,
      label: trimmed,
      city: null,
      state: trimmed,
      countryIso2: 'US',
      locationTokens: buildLocationTokens(trimmed, null, { long_name: trimmed, short_name: trimmed }, trimmed),
    };
  }

  const cityState = trimmed.match(/^([^,]+),\s*([A-Za-z]{2,})$/);
  if (cityState) {
    const city = cityState[1].trim();
    const region = cityState[2].trim();
    return {
      latitude: NaN,
      longitude: NaN,
      label: trimmed,
      city,
      state: region,
      countryIso2: 'US',
      locationTokens: buildLocationTokens(trimmed, city, { long_name: region, short_name: region }, trimmed),
    };
  }

  return null;
}

async function geocodeWithGoogle(
  apiKey: string,
  query: string,
): Promise<SearchGeoAnchor | null> {
  const params = new URLSearchParams({
    address: query.trim(),
    key: apiKey,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    results?: GoogleGeocodeResult[];
  };
  if (data.status !== 'OK' || !data.results?.length) return null;

  for (const result of data.results) {
    const anchor = geocodeResultToAnchor(query, result);
    if (anchor) return anchor;
  }
  return null;
}

/** Resolve a city/state search into coordinates + place tokens. */
export async function resolveSearchGeoAnchor(
  googleMapsApiKey: string | undefined,
  query: string,
): Promise<SearchGeoAnchor | null> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  const key = typeof googleMapsApiKey === 'string' ? googleMapsApiKey.trim() : '';
  if (key) {
    try {
      const anchor = await geocodeWithGoogle(key, trimmed);
      if (anchor) return anchor;
    } catch (e) {
      console.warn('resolveSearchGeoAnchor geocode failed:', e);
    }
  }

  const heuristic = heuristicGeoAnchor(trimmed);
  if (!heuristic) return null;

  if (key) {
    try {
      const anchor = await geocodeWithGoogle(key, trimmed);
      if (anchor) return anchor;
    } catch {
      /* fall back to text-only heuristic anchor */
    }
  }

  return heuristic;
}

export async function resolveUserSearchRadius(
  db: D1Database,
  mochaUser?: MochaUser | null,
): Promise<number> {
  if (mochaUser) {
    const row = await db
      .prepare(`SELECT location_radius_miles FROM user_profiles WHERE mocha_user_id = ?`)
      .bind(mochaUserIdKey(mochaUser))
      .first<{ location_radius_miles: number | null }>();
    const raw = row?.location_radius_miles;
    const n = raw == null ? NaN : Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.min(5000, Math.max(1, Math.trunc(n)));
  }
  return 50;
}

/** SQL fragment + bindings for clips within radius or legacy location text in searched place. */
export function clipGeoWhereClause(
  anchor: SearchGeoAnchor,
  radiusMiles: number,
): { sql: string; bindings: unknown[] } {
  const hasCoords =
    Number.isFinite(anchor.latitude) &&
    Number.isFinite(anchor.longitude);

  const locationLikes = anchor.locationTokens.map(() => `clips.location LIKE ?`).join(' OR ');
  const locationBindings = anchor.locationTokens.map((t) => `%${t}%`);

  if (!hasCoords) {
    return {
      sql: `(${locationLikes})`,
      bindings: locationBindings,
    };
  }

  const haversine = `(3959 * acos(min(1.0, max(-1.0,
    cos(radians(?)) * cos(radians(clips.geolocation_latitude)) *
    cos(radians(clips.geolocation_longitude) - radians(?)) +
    sin(radians(?)) * sin(radians(clips.geolocation_latitude))
  )))) <= ?`;

  return {
    sql: `((
      clips.geolocation_latitude IS NOT NULL
      AND clips.geolocation_longitude IS NOT NULL
      AND ${haversine}
    ) OR (
      (clips.geolocation_latitude IS NULL OR clips.geolocation_longitude IS NULL)
      AND (${locationLikes})
    ))`,
    bindings: [
      anchor.latitude,
      anchor.longitude,
      anchor.latitude,
      radiusMiles,
      ...locationBindings,
    ],
  };
}

export function filterJamBaseRecordsInRadius<T extends Record<string, unknown>>(
  records: T[],
  anchor: SearchGeoAnchor,
  radiusMiles: number,
): T[] {
  const hasCoords =
    Number.isFinite(anchor.latitude) &&
    Number.isFinite(anchor.longitude);
  if (!hasCoords) return records;

  return records.filter((rec) => {
    const c = jamBaseRecordCoords(rec);
    if (!c) return true;
    return haversineMiles(anchor.latitude, anchor.longitude, c.lat, c.lon) <= radiusMiles;
  });
}
