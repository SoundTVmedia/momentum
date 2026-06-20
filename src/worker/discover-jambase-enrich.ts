import {
  jamBaseFetch,
  type JamBaseFetchDiag,
  type JamBaseQuotaContext,
} from './jambase-client';
import { haversineMiles } from './search-geo';
import { jamBaseEventCameraCaptureDay, jamBaseEventFeedVisible, jamBaseEventUpcomingOrInProgress, jamBaseEventDateFromCaptureLocal, jamBaseVenueExpandPastEventDateCandidates } from '../shared/jambase-event-day';

/** Closest venues to enrich with in-progress listings (expandPastEvents). */
const NEARBY_VENUE_IN_SHOW_ENRICH = 8;

/** Camera capture: enrich more nearby venues with expandPastEvents. */
const CAMERA_VENUE_IN_SHOW_ENRICH = 15;
import {
  jamBaseVenueJamBaseImage,
  jamBaseVenueOfficialWebsite,
  resolveVenueLogoFromOfficialWebsite,
} from './venue-website-logo';
import {
  getVenueLogoFromCache,
  jamBaseLogoCacheKey,
  persistVenueLogoCache,
  websiteLogoCacheKey,
  type VenueLogoCacheSource,
} from './venue-logo-cache';

export type TrendingArtistRow = {
  name: string;
  image_url: string | null;
  clip_count: number;
  jambase_id: string | null;
};

/** Normalize JamBase `/artists` hits for advanced search (JamBase-only artist list). */
export function mapJamBaseArtistsToSearchRows(catalog: unknown[]): TrendingArtistRow[] {
  const records = (catalog ?? []).filter(
    (x): x is Record<string, unknown> => typeof x === 'object' && x !== null,
  );
  return records
    .map((a) => {
      const name = typeof a.name === 'string' ? a.name.trim() : '';
      if (!name) return null;
      return {
        name,
        image_url: typeof a.image === 'string' ? a.image : null,
        clip_count: 0,
        jambase_id: typeof a.identifier === 'string' ? a.identifier : null,
      };
    })
    .filter((row): row is TrendingArtistRow => row !== null);
}

export type SearchVenueRow = {
  name: string;
  location: string | null;
  clip_count: number;
  image_url: string | null;
  jambase_id: string | null;
};

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase();
}

function indexJamBaseByName(items: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (typeof item.name === 'string' && item.name.trim()) {
      map.set(normalizeEntityName(item.name), item);
    }
  }
  return map;
}

function findJamBaseById(
  items: Record<string, unknown>[],
  id: string,
): Record<string, unknown> | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  return (
    items.find((item) => typeof item.identifier === 'string' && item.identifier.trim() === trimmed) ??
    null
  );
}

function jamBaseArtistImage(artist: Record<string, unknown>): string | null {
  const image = artist.image;
  return typeof image === 'string' && image.trim() ? image.trim() : null;
}

function jamBaseArtistId(artist: Record<string, unknown>): string | null {
  const id = artist.identifier;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function jamBaseVenueImage(venue: Record<string, unknown>): string | null {
  return jamBaseVenueJamBaseImage(venue);
}

async function fetchJamBaseVenueById(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  venueId: string,
): Promise<Record<string, unknown> | null> {
  const data = await jamBaseFetch<Record<string, unknown>>(
    apiKey,
    `/venues/${encodeURIComponent(venueId)}`,
    {},
    jbQ,
  );
  return data ?? null;
}

/** JamBase venue photo, then logo from official website — cached permanently in D1. */
async function resolveJamBaseVenueImageWithFallback(
  db: D1Database,
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  venue: Record<string, unknown>,
): Promise<string | null> {
  const jambaseId = jamBaseVenueId(venue);
  const websiteHint = jamBaseVenueOfficialWebsite(venue);
  const cacheKeys = [
    jambaseId ? jamBaseLogoCacheKey(jambaseId) : null,
    websiteHint ? websiteLogoCacheKey(websiteHint) : null,
  ].filter((k): k is string => Boolean(k));

  const cached = await getVenueLogoFromCache(db, cacheKeys);
  if (cached !== undefined) return cached;

  let sourceVenue = venue;
  if (!websiteHint && jambaseId) {
    try {
      const full = await fetchJamBaseVenueById(apiKey, jbQ, jambaseId);
      if (full) sourceVenue = full;
    } catch (e) {
      console.warn('resolveJamBaseVenueImageWithFallback fetchById:', jambaseId, e);
    }
  }

  let logoUrl: string | null = jamBaseVenueJamBaseImage(sourceVenue);
  let source: VenueLogoCacheSource = logoUrl ? 'jambase' : 'none';

  if (!logoUrl) {
    try {
      logoUrl = await resolveVenueLogoFromOfficialWebsite(db, sourceVenue);
      if (logoUrl) source = 'website';
    } catch (e) {
      console.warn('resolveJamBaseVenueImageWithFallback website logo:', e);
    }
  }

  const resolvedId = jamBaseVenueId(sourceVenue) ?? jambaseId;
  const resolvedWebsite = jamBaseVenueOfficialWebsite(sourceVenue) ?? websiteHint;
  const persistEntries: Array<{
    cacheKey: string;
    jambaseId?: string | null;
    websiteUrl?: string | null;
    logoUrl: string | null;
    source: VenueLogoCacheSource;
  }> = [];

  if (resolvedId) {
    persistEntries.push({
      cacheKey: jamBaseLogoCacheKey(resolvedId),
      jambaseId: resolvedId,
      websiteUrl: resolvedWebsite,
      logoUrl,
      source,
    });
  }
  if (resolvedWebsite) {
    persistEntries.push({
      cacheKey: websiteLogoCacheKey(resolvedWebsite),
      jambaseId: resolvedId,
      websiteUrl: resolvedWebsite,
      logoUrl,
      source,
    });
  }

  if (persistEntries.length > 0) {
    await persistVenueLogoCache(db, persistEntries);
  }

  return logoUrl;
}

function jamBaseVenueId(venue: Record<string, unknown>): string | null {
  const id = venue.identifier;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

const ENRICH_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function jamBaseVenueLocation(venue: Record<string, unknown>): string | null {
  const addr = venue.address as Record<string, unknown> | undefined;
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const locality =
    typeof addr?.addressLocality === 'string' ? addr.addressLocality.trim() : '';
  const regionName =
    typeof region?.alternateName === 'string'
      ? region.alternateName.trim()
      : typeof region?.name === 'string'
        ? String(region.name).trim()
        : '';
  const line = [locality, regionName].filter(Boolean).join(', ');
  return line || null;
}

function applyJamBaseArtistRow(
  row: TrendingArtistRow,
  catalog: Record<string, unknown>[],
  byName: Map<string, Record<string, unknown>>,
): TrendingArtistRow {
  if (row.image_url?.trim()) return row;

  const byId = row.jambase_id ? findJamBaseById(catalog, row.jambase_id) : null;
  const byNameMatch = byName.get(normalizeEntityName(row.name));
  const jb = byId ?? byNameMatch;
  if (!jb) return row;

  return {
    ...row,
    image_url: jamBaseArtistImage(jb) ?? row.image_url,
    jambase_id: jamBaseArtistId(jb) ?? row.jambase_id,
  };
}

function applyJamBaseVenueRow(
  row: SearchVenueRow,
  catalog: Record<string, unknown>[],
  byName: Map<string, Record<string, unknown>>,
): SearchVenueRow {
  const byId = row.jambase_id ? findJamBaseById(catalog, row.jambase_id) : null;
  const byNameMatch = byName.get(normalizeEntityName(row.name));
  const jb = byId ?? byNameMatch;
  if (!jb) return row;

  const jbImage = jamBaseVenueImage(jb);
  return {
    ...row,
    image_url: jbImage ?? row.image_url,
    jambase_id: jamBaseVenueId(jb) ?? row.jambase_id,
    location: row.location ?? jamBaseVenueLocation(jb),
  };
}

export function jamBaseVenueToSearchRow(v: Record<string, unknown>): SearchVenueRow | null {
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!name) return null;
  return {
    name,
    location: jamBaseVenueLocation(v),
    clip_count: 0,
    image_url: jamBaseVenueImage(v),
    jambase_id: jamBaseVenueId(v),
  };
}

export async function fetchJamBaseVenuesByCity(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  city: string,
  countryIso2 = 'US',
  limit = 20,
): Promise<Record<string, unknown>[]> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const cityTrim = city.trim();
  if (!key || !cityTrim) return [];

  const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
    key,
    '/venues',
    {
      geoCityName: cityTrim,
      geoCountryIso2: countryIso2,
      perPage: String(Math.min(40, Math.max(1, limit))),
      page: '1',
    },
    jbQ,
  );
  return data?.venues ?? [];
}

/** Catalog-only venue merge — no extra JamBase API calls (typeahead / compact search). */
export function matchSearchVenuesToJamBaseCatalog(
  venues: SearchVenueRow[],
  jambaseCatalog: unknown[],
): SearchVenueRow[] {
  const catalog = (jambaseCatalog ?? []).filter(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
  );
  const byName = indexJamBaseByName(catalog);
  return venues.map((row) => applyJamBaseVenueRow(row, catalog, byName));
}

async function fetchJamBaseArtistById(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  artistId: string,
): Promise<Record<string, unknown> | null> {
  const data = await jamBaseFetch<Record<string, unknown>>(
    apiKey,
    `/artists/${encodeURIComponent(artistId)}`,
    {},
    jbQ,
  );
  return data ?? null;
}

async function searchJamBaseVenueByName(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  name: string,
): Promise<Record<string, unknown> | null> {
  const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
    apiKey,
    '/venues',
    { venueName: name, perPage: '3', page: '1' },
    jbQ,
  );
  const list = data?.venues ?? [];
  if (!list.length) return null;
  const exact = list.find(
    (v) => typeof v.name === 'string' && v.name.trim().toLowerCase() === name.toLowerCase(),
  );
  return exact ?? list[0] ?? null;
}

async function searchJamBaseArtistByName(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  name: string,
): Promise<Record<string, unknown> | null> {
  const data = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
    apiKey,
    '/artists',
    { artistName: name, perPage: '3', page: '1' },
    jbQ,
  );
  const list = data?.artists ?? [];
  if (!list.length) return null;
  const exact = list.find(
    (a) => typeof a.name === 'string' && a.name.trim().toLowerCase() === name.toLowerCase(),
  );
  return exact ?? list[0] ?? null;
}

/**
 * Prefer local `image_url`, then JamBase artist id from clips/artists, then name search.
 */
export async function enrichTrendingArtistsWithJamBase(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  artists: TrendingArtistRow[],
): Promise<TrendingArtistRow[]> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key || artists.length === 0) {
    return artists;
  }

  return mapWithConcurrency(artists, ENRICH_CONCURRENCY, async (row) => {
    if (row.image_url?.trim()) return row;

    let imageUrl: string | null = null;
    let jambaseId = row.jambase_id;

    try {
      if (jambaseId) {
        const byId = await fetchJamBaseArtistById(key, jbQ, jambaseId);
        if (byId) {
          imageUrl = jamBaseArtistImage(byId);
          jambaseId = jamBaseArtistId(byId) ?? jambaseId;
        }
      }
      if (!imageUrl) {
        const byName = await searchJamBaseArtistByName(key, jbQ, row.name);
        if (byName) {
          imageUrl = jamBaseArtistImage(byName);
          jambaseId = jamBaseArtistId(byName) ?? jambaseId;
        }
      }
    } catch (e) {
      console.warn('enrichTrendingArtistsWithJamBase:', row.name, e);
    }

    return {
      ...row,
      image_url: imageUrl ?? row.image_url,
      jambase_id: jambaseId,
    };
  });
}

/** Match search artists to the JamBase catalog returned for the same query, then fetch any remaining images. */
export async function enrichSearchArtistsWithJamBase(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  artists: TrendingArtistRow[],
  jambaseCatalog: unknown[],
): Promise<TrendingArtistRow[]> {
  const catalog = (jambaseCatalog ?? []).filter(
    (a): a is Record<string, unknown> => typeof a === 'object' && a !== null,
  );
  const byName = indexJamBaseByName(catalog);
  const matched = artists.map((row) => applyJamBaseArtistRow(row, catalog, byName));
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return matched;
  if (!matched.some((row) => !row.image_url?.trim())) return matched;
  return enrichTrendingArtistsWithJamBase(key, jbQ, matched);
}

/** Match search venues to the JamBase catalog returned for the same query, then fetch any remaining images. */
export async function enrichSearchVenuesWithJamBase(
  db: D1Database,
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  venues: SearchVenueRow[],
  jambaseCatalog: unknown[],
): Promise<SearchVenueRow[]> {
  const catalog = (jambaseCatalog ?? []).filter(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
  );
  const byName = indexJamBaseByName(catalog);
  const matched = venues.map((row) => applyJamBaseVenueRow(row, catalog, byName));

  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return matched;

  if (!matched.some((row) => !row.image_url?.trim())) return matched;

  return mapWithConcurrency(matched, ENRICH_CONCURRENCY, async (row) => {
    if (row.image_url?.trim()) return row;
    let imageUrl: string | null = null;
    let jambaseId = row.jambase_id;
    let location = row.location;
    try {
      let jb: Record<string, unknown> | null = row.jambase_id
        ? findJamBaseById(catalog, row.jambase_id)
        : null;
      if (!jb) {
        jb = byName.get(normalizeEntityName(row.name)) ?? null;
      }
      if (!jb) {
        jb = await searchJamBaseVenueByName(key, jbQ, row.name);
      }
      if (jb) {
        imageUrl = await resolveJamBaseVenueImageWithFallback(db, key, jbQ, jb);
        jambaseId = jamBaseVenueId(jb) ?? jambaseId;
        location = location ?? jamBaseVenueLocation(jb);
      }
    } catch (e) {
      console.warn('enrichSearchVenuesWithJamBase:', row.name, e);
    }
    return {
      ...row,
      image_url: imageUrl ?? row.image_url,
      jambase_id: jambaseId,
      location,
    };
  });
}

/** JamBase venue image with official-website logo fallback (for venue pages, etc.). */
export async function enrichJamBaseVenueImage(
  db: D1Database,
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  venue: Record<string, unknown>,
): Promise<string | null> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) {
    const jambaseId = jamBaseVenueId(venue);
    const websiteHint = jamBaseVenueOfficialWebsite(venue);
    const cacheKeys = [
      jambaseId ? jamBaseLogoCacheKey(jambaseId) : null,
      websiteHint ? websiteLogoCacheKey(websiteHint) : null,
    ].filter((k): k is string => Boolean(k));
    const cached = await getVenueLogoFromCache(db, cacheKeys);
    if (cached !== undefined) return cached;
    return jamBaseVenueJamBaseImage(venue);
  }
  return resolveJamBaseVenueImageWithFallback(db, key, jbQ, venue);
}

function jamBaseEventId(ev: Record<string, unknown>): string | null {
  return typeof ev.identifier === 'string' ? ev.identifier : null;
}

function jamBaseGeoRecordCoords(record: Record<string, unknown>): { lat: number; lon: number } | null {
  const fromEventShape = jamBaseEventCoords(record);
  if (fromEventShape) return fromEventShape;
  const addr = record.address as Record<string, unknown> | undefined;
  const ag = addr?.geo as Record<string, unknown> | undefined;
  if (ag) {
    const lat = Number(ag.latitude ?? ag.lat);
    const lon = Number(ag.longitude ?? ag.lon ?? ag.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const lat = Number(record.latitude ?? record.lat);
  const lon = Number(record.longitude ?? record.lon ?? record.lng);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
}

function sortJamBaseVenuesByDistanceFrom(
  venues: Record<string, unknown>[],
  latitude: number,
  longitude: number,
): Record<string, unknown>[] {
  return [...venues].sort((a, b) => {
    const ca = jamBaseGeoRecordCoords(a);
    const cb = jamBaseGeoRecordCoords(b);
    const da = ca ? haversineMiles(latitude, longitude, ca.lat, ca.lon) : Number.POSITIVE_INFINITY;
    const db = cb ? haversineMiles(latitude, longitude, cb.lat, cb.lon) : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

async function fetchVenueExpandPastEvents(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  venueId: string,
  captureMs: number,
  latitude: number,
  longitude: number,
): Promise<Record<string, unknown>[]> {
  const dateCandidates = jamBaseVenueExpandPastEventDateCandidates(
    captureMs,
    latitude,
    longitude,
  );
  const merged = new Map<string, Record<string, unknown>>();
  for (const eventDateFrom of dateCandidates) {
    const data = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      apiKey,
      '/events',
      {
        venueId,
        eventDateFrom,
        perPage: '25',
        page: '1',
        expandPastEvents: 'true',
      },
      jbQ,
    );
    for (const ev of data?.events ?? []) {
      if (typeof ev !== 'object' || ev === null) continue;
      const row = ev as Record<string, unknown>;
      const id = jamBaseEventId(row);
      const key = id ?? JSON.stringify(row);
      if (!merged.has(key)) merged.set(key, row);
    }
  }
  return [...merged.values()];
}

async function fetchExpandPastEventsAtNearbyVenues(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles: number,
  captureMs: number,
  maxVenues: number,
  matchesCapture: (ev: Record<string, unknown>) => boolean,
): Promise<{ events: Record<string, unknown>[]; venuesScanned: number; rawBeforeFilterCount: number }> {
  const venuesData = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
    apiKey,
    '/venues',
    {
      geoLatitude: String(latitude),
      geoLongitude: String(longitude),
      geoRadiusAmount: String(radiusMiles),
      geoRadiusUnits: 'mi',
      perPage: '25',
      page: '1',
    },
    jbQ,
  );
  const venues = sortJamBaseVenuesByDistanceFrom(venuesData?.venues ?? [], latitude, longitude)
    .slice(0, maxVenues);

  const results = await Promise.allSettled(
    venues.map(async (venue) => {
      const venueId = jamBaseVenueId(venue);
      if (!venueId) return [] as Record<string, unknown>[];
      return fetchVenueExpandPastEvents(
        apiKey,
        jbQ,
        venueId,
        captureMs,
        latitude,
        longitude,
      );
    }),
  );

  const merged: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let rawBeforeFilterCount = 0;
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const ev of result.value) {
      if (typeof ev !== 'object' || ev === null) continue;
      rawBeforeFilterCount += 1;
      const row = ev as Record<string, unknown>;
      if (!matchesCapture(row)) continue;
      const id = jamBaseEventId(row);
      const key = id ?? JSON.stringify(row);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
  }
  return { events: merged, venuesScanned: venues.length, rawBeforeFilterCount };
}

async function fetchInShowEventsAtNearbyVenues(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles: number,
  captureMs: number,
  matchesCapture: (ev: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>[]> {
  const { events } = await fetchExpandPastEventsAtNearbyVenues(
    apiKey,
    jbQ,
    latitude,
    longitude,
    radiusMiles,
    captureMs,
    NEARBY_VENUE_IN_SHOW_ENRICH,
    matchesCapture,
  );
  return events;
}

type NearbyJamBaseEventsScope = 'tonight' | 'upcoming';

async function fetchNearbyJamBaseEventsScoped(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles: number,
  limit: number,
  diag: JamBaseFetchDiag | undefined,
  captureMs: number,
  scope: NearbyJamBaseEventsScope,
): Promise<Record<string, unknown>[]> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return [];

  const radius = Math.min(100, Math.max(10, radiusMiles));

  const visible =
    scope === 'tonight'
      ? (ev: Record<string, unknown>) =>
          jamBaseEventFeedVisible(ev, captureMs, latitude, longitude)
      : (ev: Record<string, unknown>) =>
          jamBaseEventUpcomingOrInProgress(ev, captureMs, latitude, longitude);

  const [geoData, inShowEvents] = await Promise.all([
    jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      key,
      '/events',
      {
        geoLatitude: String(latitude),
        geoLongitude: String(longitude),
        geoRadiusAmount: String(radius),
        geoRadiusUnits: 'mi',
        eventDateFrom: jamBaseEventDateFromCaptureLocal(captureMs, latitude, longitude),
        perPage: String(Math.min(40, Math.max(1, limit))),
        page: '1',
      },
      jbQ,
      diag,
    ),
    fetchInShowEventsAtNearbyVenues(
      key,
      jbQ,
      latitude,
      longitude,
      radius,
      captureMs,
      visible,
    ),
  ]);

  const merged = new Map<string, Record<string, unknown>>();
  for (const ev of geoData?.events ?? []) {
    if (typeof ev !== 'object' || ev === null) continue;
    if (!visible(ev)) continue;
    const id = jamBaseEventId(ev);
    const mapKey = id ?? JSON.stringify(ev);
    if (!merged.has(mapKey)) merged.set(mapKey, ev);
  }
  for (const ev of inShowEvents) {
    if (typeof ev !== 'object' || ev === null) continue;
    if (!visible(ev)) continue;
    const id = jamBaseEventId(ev);
    const mapKey = id ?? JSON.stringify(ev);
    if (!merged.has(mapKey)) merged.set(mapKey, ev);
  }

  const raw = [...merged.values()];
  return sortJamBaseEventsByDistanceFrom(raw, latitude, longitude).slice(0, limit);
}

function jamBaseEventCoords(ev: Record<string, unknown>): { lat: number; lon: number } | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  if (!loc) return null;
  const geo = loc.geo as Record<string, unknown> | undefined;
  if (geo) {
    const lat = Number(geo.latitude ?? geo.lat);
    const lon = Number(geo.longitude ?? geo.lon ?? geo.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const addr = loc.address as Record<string, unknown> | undefined;
  const ag = addr?.geo as Record<string, unknown> | undefined;
  if (ag) {
    const lat = Number(ag.latitude ?? ag.lat);
    const lon = Number(ag.longitude ?? ag.lon ?? ag.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const lat = Number(loc.latitude ?? loc.lat);
  const lon = Number(loc.longitude ?? loc.lon ?? loc.lng);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
}

function sortJamBaseEventsByDistanceFrom(
  events: Record<string, unknown>[],
  latitude: number,
  longitude: number,
): Record<string, unknown>[] {
  return [...events].sort((a, b) => {
    const ca = jamBaseEventCoords(a);
    const cb = jamBaseEventCoords(b);
    const da = ca ? haversineMiles(latitude, longitude, ca.lat, ca.lon) : Number.POSITIVE_INFINITY;
    const db = cb ? haversineMiles(latitude, longitude, cb.lat, cb.lon) : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    const sa = typeof a.startDate === 'string' ? a.startDate : '';
    const sb = typeof b.startDate === 'string' ? b.startDate : '';
    return sa.localeCompare(sb);
  });
}

export async function fetchTonightJamBaseEvents(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles = 50,
  limit = 20,
  diag?: JamBaseFetchDiag,
  captureMs: number = Date.now(),
): Promise<Record<string, unknown>[]> {
  return fetchNearbyJamBaseEventsScoped(
    apiKey,
    jbQ,
    latitude,
    longitude,
    radiusMiles,
    limit,
    diag,
    captureMs,
    'tonight',
  );
}

export async function fetchNearbyJamBaseEvents(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles = 50,
  limit = 20,
  diag?: JamBaseFetchDiag,
  captureMs: number = Date.now(),
): Promise<Record<string, unknown>[]> {
  return fetchNearbyJamBaseEventsScoped(
    apiKey,
    jbQ,
    latitude,
    longitude,
    radiusMiles,
    limit,
    diag,
    captureMs,
    'upcoming',
  );
}

/**
 * Camera venue picker: geo upcoming events + expandPastEvents at the closest venues,
 * filtered to the capture calendar day (in-progress shows up to 10h after start).
 */
export type CameraJamBaseFetchStats = {
  geoEventRawCount: number;
  geoEventMatchedCount: number;
  expandPastVenueCount: number;
  expandPastEventRawCount: number;
  expandPastEventMatchedCount: number;
  captureLocalYmd: string;
  eventDateFromTried: string[];
};

export async function fetchCameraVenueJamBaseEvents(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  captureMs: number,
  radiusMiles = 50,
  limit = 50,
  diag?: JamBaseFetchDiag,
): Promise<{ events: Record<string, unknown>[]; stats: CameraJamBaseFetchStats }> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const emptyStats: CameraJamBaseFetchStats = {
    geoEventRawCount: 0,
    geoEventMatchedCount: 0,
    expandPastVenueCount: 0,
    expandPastEventRawCount: 0,
    expandPastEventMatchedCount: 0,
    captureLocalYmd: jamBaseEventDateFromCaptureLocal(captureMs, latitude, longitude),
    eventDateFromTried: jamBaseVenueExpandPastEventDateCandidates(
      captureMs,
      latitude,
      longitude,
    ),
  };
  if (!key) return { events: [], stats: emptyStats };

  const radius = Math.min(100, Math.max(10, radiusMiles));
  const matchesCameraDay = (ev: Record<string, unknown>) =>
    jamBaseEventCameraCaptureDay(ev, captureMs, latitude, longitude);

  const geoDateFrom = jamBaseEventDateFromCaptureLocal(captureMs, latitude, longitude);
  const [geoData, expandPast] = await Promise.all([
    jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      key,
      '/events',
      {
        geoLatitude: String(latitude),
        geoLongitude: String(longitude),
        geoRadiusAmount: String(radius),
        geoRadiusUnits: 'mi',
        eventDateFrom: geoDateFrom,
        perPage: String(Math.min(40, Math.max(1, limit))),
        page: '1',
      },
      jbQ,
      diag,
    ),
    fetchExpandPastEventsAtNearbyVenues(
      key,
      jbQ,
      latitude,
      longitude,
      radius,
      captureMs,
      CAMERA_VENUE_IN_SHOW_ENRICH,
      matchesCameraDay,
    ),
  ]);

  const geoRaw = geoData?.events ?? [];
  let geoMatchedCount = 0;
  const merged = new Map<string, Record<string, unknown>>();
  for (const ev of geoRaw) {
    if (typeof ev !== 'object' || ev === null) continue;
    if (!matchesCameraDay(ev)) continue;
    geoMatchedCount += 1;
    const id = jamBaseEventId(ev);
    const mapKey = id ?? JSON.stringify(ev);
    if (!merged.has(mapKey)) merged.set(mapKey, ev);
  }

  for (const ev of expandPast.events) {
    if (typeof ev !== 'object' || ev === null) continue;
    const id = jamBaseEventId(ev);
    const mapKey = id ?? JSON.stringify(ev);
    if (!merged.has(mapKey)) merged.set(mapKey, ev);
  }

  const raw = sortJamBaseEventsByDistanceFrom(
    [...merged.values()],
    latitude,
    longitude,
  ).slice(0, limit);

  return {
    events: raw,
    stats: {
      geoEventRawCount: geoRaw.length,
      geoEventMatchedCount: geoMatchedCount,
      expandPastVenueCount: expandPast.venuesScanned,
      expandPastEventRawCount: expandPast.rawBeforeFilterCount,
      expandPastEventMatchedCount: expandPast.events.length,
      captureLocalYmd: emptyStats.captureLocalYmd,
      eventDateFromTried: emptyStats.eventDateFromTried,
    },
  };
}
