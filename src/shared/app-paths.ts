import { slugifyEntityName } from '@/shared/jambase-slug';

export function artistPath(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug ? `/artists/${slug}` : '/artists';
}

export function venuePath(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug ? `/venues/${slug}` : '/venues';
}

export function apiArtistPath(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug ? `/api/artists/${slug}` : '/api/artists';
}

export function apiVenuePath(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug ? `/api/venues/${slug}` : '/api/venues';
}

export function songPath(
  artistName: string | null | undefined,
  songSlug: string | null | undefined,
): string {
  const a = slugifyEntityName(artistName);
  const s = typeof songSlug === 'string' ? songSlug.trim().toLowerCase() : '';
  if (!a || !s) return '/';
  return `/artists/${a}/songs/${s}`;
}

export function apiSongPath(
  artistName: string | null | undefined,
  songSlug: string | null | undefined,
): string {
  const a = slugifyEntityName(artistName);
  const s = typeof songSlug === 'string' ? songSlug.trim().toLowerCase() : '';
  if (!a || !s) return '';
  return `/api/artists/${a}/songs/${s}`;
}
