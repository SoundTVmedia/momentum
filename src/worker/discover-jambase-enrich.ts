import {
  jamBaseFetch,
  jamBaseEventDateFromToday,
  type JamBaseQuotaContext,
} from './jambase-client';

export type TrendingArtistRow = {
  name: string;
  image_url: string | null;
  clip_count: number;
  jambase_id: string | null;
};

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
  const image = venue.image;
  return typeof image === 'string' && image.trim() ? image.trim() : null;
}

function jamBaseVenueId(venue: Record<string, unknown>): string | null {
  const id = venue.identifier;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
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
  if (row.image_url?.trim()) return row;

  const byId = row.jambase_id ? findJamBaseById(catalog, row.jambase_id) : null;
  const byNameMatch = byName.get(normalizeEntityName(row.name));
  const jb = byId ?? byNameMatch;
  if (!jb) return row;

  return {
    ...row,
    image_url: jamBaseVenueImage(jb) ?? row.image_url,
    jambase_id: jamBaseVenueId(jb) ?? row.jambase_id,
    location: row.location ?? jamBaseVenueLocation(jb),
  };
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

  const out: TrendingArtistRow[] = [];
  for (const row of artists) {
    if (row.image_url) {
      out.push(row);
      continue;
    }

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

    out.push({
      ...row,
      image_url: imageUrl ?? row.image_url,
      jambase_id: jambaseId,
    });
  }

  return out;
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
  return enrichTrendingArtistsWithJamBase(key, jbQ, matched);
}

/** Match search venues to the JamBase catalog returned for the same query, then fetch any remaining images. */
export async function enrichSearchVenuesWithJamBase(
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

  const out: SearchVenueRow[] = [];
  for (const row of matched) {
    if (row.image_url?.trim()) {
      out.push(row);
      continue;
    }
    let imageUrl: string | null = null;
    let jambaseId = row.jambase_id;
    let location = row.location;
    try {
      const jb = await searchJamBaseVenueByName(key, jbQ, row.name);
      if (jb) {
        imageUrl = jamBaseVenueImage(jb);
        jambaseId = jamBaseVenueId(jb) ?? jambaseId;
        location = location ?? jamBaseVenueLocation(jb);
      }
    } catch (e) {
      console.warn('enrichSearchVenuesWithJamBase:', row.name, e);
    }
    out.push({
      ...row,
      image_url: imageUrl ?? row.image_url,
      jambase_id: jambaseId,
      location,
    });
  }
  return out;
}

export async function fetchNearbyJamBaseEvents(
  apiKey: string | undefined,
  jbQ: JamBaseQuotaContext | undefined,
  latitude: number,
  longitude: number,
  radiusMiles = 50,
  limit = 20,
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
  );

  return data?.events ?? [];
}
