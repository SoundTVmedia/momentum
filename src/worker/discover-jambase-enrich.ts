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

function jamBaseArtistImage(artist: Record<string, unknown>): string | null {
  const image = artist.image;
  return typeof image === 'string' && image.trim() ? image.trim() : null;
}

function jamBaseArtistId(artist: Record<string, unknown>): string | null {
  const id = artist.identifier;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
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
