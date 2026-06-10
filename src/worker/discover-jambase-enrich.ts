import {
  jamBaseFetch,
  jamBaseEventDateFromToday,
  type JamBaseFetchDiag,
  type JamBaseQuotaContext,
} from './jambase-client';
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

export async function fetchNearbyJamBaseEvents(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles = 50,
  limit = 20,
  diag?: JamBaseFetchDiag,
): Promise<Record<string, unknown>[]> {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return [];

  const data = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
    key,
    '/events',
    {
      geoLatitude: String(latitude),
      geoLongitude: String(longitude),
      geoRadiusAmount: String(Math.min(100, Math.max(10, radiusMiles))),
      geoRadiusUnits: 'mi',
      eventDateFrom: jamBaseEventDateFromToday(),
      perPage: String(Math.min(40, Math.max(1, limit))),
      page: '1',
    },
    jbQ,
    diag,
  );

  return data?.events ?? [];
}
