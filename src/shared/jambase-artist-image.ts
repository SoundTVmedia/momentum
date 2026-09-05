import { slugifyEntityName } from './jambase-slug';

export type JamBaseArtistImageHit = {
  name?: string | null;
  image?: string | null;
};

/** Prefer an exact name match so a search for "Phish" does not take a tribute act. */
export function pickJamBaseArtistImage(
  queryName: string,
  artists: JamBaseArtistImageHit[],
): string | null {
  if (!artists.length) return null;
  const slug = slugifyEntityName(queryName);
  const exact = artists.find((artist) => slugifyEntityName(String(artist.name ?? '')) === slug);
  const pick = exact ?? artists[0];
  const image = typeof pick?.image === 'string' ? pick.image.trim() : '';
  return image || null;
}
