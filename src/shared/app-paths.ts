import { slugifyEntityName } from '@/shared/jambase-slug';
import { computeShowId } from './show-id';

export type ShowMarkClipsInput = {
  event_title?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  start_date?: string | null;
  jambase_event_id?: string | null;
};

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

export function apiArtistYoutubeVideosPath(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug ? `/api/youtube/artist/${encodeURIComponent(slug)}/videos` : '';
}

export function apiVenuePath(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug ? `/api/venues/${slug}` : '/api/venues';
}

/** Clips from a specific show (artist + show_id from JamBase or composite slug). */
export function showClipsPath(
  artistName: string | null | undefined,
  showId: string | null | undefined,
): string {
  const artistSlug = slugifyEntityName(artistName);
  const id = typeof showId === 'string' ? showId.trim() : '';
  if (!artistSlug || !id) return artistPath(artistName);
  return `/artists/${artistSlug}/shows/${encodeURIComponent(id)}/clips`;
}

export function apiShowClipsPath(
  artistName: string | null | undefined,
  showId: string | null | undefined,
): string {
  const artistSlug = slugifyEntityName(artistName);
  const id = typeof showId === 'string' ? showId.trim() : '';
  if (!artistSlug || !id) return '';
  return `/api/artists/${artistSlug}/shows/${encodeURIComponent(id)}/clips`;
}

/** All clips sharing the same JamBase-style event title. */
export function eventClipsPath(eventTitle: string | null | undefined): string {
  const title = typeof eventTitle === 'string' ? eventTitle.trim() : '';
  if (!title) return '/';
  return `/events/clips/${encodeURIComponent(title)}`;
}

export function apiEventClipsPath(eventTitle: string | null | undefined): string {
  const title = typeof eventTitle === 'string' ? eventTitle.trim() : '';
  if (!title) return '';
  return `/api/event-clips/${encodeURIComponent(title)}/clips`;
}

/** Route to the show clips page for a stored mark (event title preferred, else artist + show id). */
export function showMarkClipsPath(mark: ShowMarkClipsInput): string | null {
  const title = mark.event_title?.trim();
  if (title) return eventClipsPath(title);

  const artist = mark.artist_name?.trim();
  const showId =
    mark.jambase_event_id?.trim() ||
    computeShowId({
      jambase_event_id: mark.jambase_event_id,
      artist_name: mark.artist_name,
      venue_name: mark.venue_name,
      timestamp: mark.start_date,
    });
  if (artist && showId) return showClipsPath(artist, showId);

  return null;
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

/** Global song hub — clips with this `song_slug` (any artist). */
export function globalSongPath(songSlug: string | null | undefined): string {
  const s = typeof songSlug === 'string' ? songSlug.trim().toLowerCase() : '';
  return s ? `/songs/${s}` : '/songs';
}

export function apiGlobalSongPath(songSlug: string | null | undefined): string {
  const s = typeof songSlug === 'string' ? songSlug.trim().toLowerCase() : '';
  return s ? `/api/songs/${s}` : '';
}

export function genrePath(genreSlug: string | null | undefined): string {
  const g = typeof genreSlug === 'string' ? genreSlug.trim().toLowerCase() : '';
  return g ? `/genres/${g}` : '/genres';
}

export function apiGenrePath(genreSlug: string | null | undefined): string {
  const g = typeof genreSlug === 'string' ? genreSlug.trim().toLowerCase() : '';
  return g ? `/api/genres/${g}` : '';
}
