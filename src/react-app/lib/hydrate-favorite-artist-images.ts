import { apiFetch } from '@/react-app/lib/apiFetch';
import { pickJamBaseArtistImage } from '@/shared/jambase-artist-image';
import type { JamBaseArtist } from '@/shared/types';

const HYDRATE_CONCURRENCY = 4;

async function fetchJamBaseArtistImage(name: string): Promise<string | null> {
  const query = name.trim();
  if (query.length < 2) return null;
  try {
    const response = await apiFetch(
      `/api/jambase/search/artists?q=${encodeURIComponent(query)}&limit=5`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { artists?: JamBaseArtist[] };
    return pickJamBaseArtistImage(query, data.artists ?? []);
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await mapper(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Fill missing favorite-artist photos from JamBase (same source as festival lineup cards). */
export async function hydrateFavoriteArtistImages<T extends { name: string; image_url?: string | null }>(
  artists: T[],
): Promise<T[]> {
  const missing = artists.filter((artist) => !artist.image_url?.trim());
  if (missing.length === 0) return artists;

  const rows = await mapWithConcurrency(missing, HYDRATE_CONCURRENCY, async (artist) => {
    const imageUrl = await fetchJamBaseArtistImage(artist.name);
    return [artist.name, imageUrl] as const;
  });

  const byName = new Map<string, string>();
  for (const [name, imageUrl] of rows) {
    if (imageUrl) byName.set(name, imageUrl);
  }
  if (byName.size === 0) return artists;

  return artists.map((artist) => {
    if (artist.image_url?.trim()) return artist;
    const imageUrl = byName.get(artist.name);
    return imageUrl ? { ...artist, image_url: imageUrl } : artist;
  });
}
