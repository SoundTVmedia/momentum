import { slugifyEntityName } from './jambase-slug';
import { computeLegacyClipShowKey, computeShowId } from './show-id';
import { resolveClipEventTitle } from './event-title';

export type ShowMarkClipsInput = {
  event_title?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  start_date?: string | null;
  jambase_event_id?: string | null;
};

export type PastShowClipsInput = ShowMarkClipsInput & {
  show_id?: string | null;
  show_date?: string | null;
};

export type ClipShowClipsInput = ShowMarkClipsInput & {
  show_id?: string | null;
  timestamp?: string | null;
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

/** Clips from one past-show card, including its date-aware fallback identity. */
export function pastShowClipsPath(show: PastShowClipsInput): string {
  const showId =
    show.show_id?.trim() ||
    show.jambase_event_id?.trim() ||
    computeShowId({
      jambase_event_id: show.jambase_event_id,
      artist_name: show.artist_name,
      venue_name: show.venue_name,
      timestamp: show.show_date,
    });
  return showClipsPath(show.artist_name, showId);
}

/** The exact show for a clip, with a title-based fallback for legacy clip rows. */
export function clipShowClipsPath(clip: ClipShowClipsInput): string {
  const showId =
    clip.show_id?.trim() ||
    clip.jambase_event_id?.trim() ||
    computeLegacyClipShowKey({
      artist_name: clip.artist_name,
      venue_name: clip.venue_name,
      timestamp: clip.timestamp,
    });
  if (clip.artist_name?.trim() && showId) {
    return showClipsPath(clip.artist_name, showId);
  }

  const eventTitle = resolveClipEventTitle(clip);
  return eventTitle ? eventClipsPath(eventTitle) : artistPath(clip.artist_name);
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

/** Route to the show clips page for a stored mark (artist + show id preferred). */
export function showMarkClipsPath(mark: ShowMarkClipsInput): string | null {
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

  const title = mark.event_title?.trim();
  if (title) return eventClipsPath(title);

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
