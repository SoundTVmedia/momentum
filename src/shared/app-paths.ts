import { festivalCanonicalSlug, isJamBaseFestivalEvent } from './jambase-festival';
import { slugifyEntityName } from './jambase-slug';
import { computeShowId, resolveClipShowNavigationId } from './show-id';
import { jamBaseEventTitle, resolveClipEventTitle } from './event-title';
import {
  jamBaseEventArtistName,
  jamBaseEventId,
  jamBaseEventVenueName,
} from './jambase-events';
import { isFeedbackLibraryShow } from './library-shows';

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

export function festivalPath(name: string | null | undefined): string {
  const slug = festivalCanonicalSlug(name) || slugifyEntityName(name);
  return slug ? `/festivals/${slug}` : '/festivals';
}

/** Festival hub for an event-title clips page, or null when this is a regular show. */
export function festivalPageHrefFromEvent(
  ev: Record<string, unknown> | null | undefined,
  fallbackName?: string | null,
): string | null {
  const fromEvent =
    (ev && (jamBaseEventTitle(ev) || (typeof ev.name === 'string' ? ev.name.trim() : ''))) || '';
  const fallback = typeof fallbackName === 'string' ? fallbackName.trim() : '';
  const titles = [...new Set([fallback, fromEvent].filter(Boolean))];
  for (const title of titles) {
    if (!isJamBaseFestivalEvent(ev) && !isJamBaseFestivalEvent({ name: title })) continue;
    const path = festivalPath(title);
    if (path !== '/festivals') return path;
  }
  return null;
}

export function apiFestivalPath(name: string | null | undefined): string {
  const slug = festivalCanonicalSlug(name) || slugifyEntityName(name);
  return slug ? `/api/festivals/${slug}` : '/api/festivals';
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

/** Show clips page (or festival page) for a JamBase-shaped event card. */
export function jamBaseEventShowPath(ev: Record<string, unknown>): string {
  if (isJamBaseFestivalEvent(ev)) {
    const name = jamBaseEventTitle(ev) || (typeof ev.name === 'string' ? ev.name : '');
    const path = festivalPath(name);
    if (path !== '/festivals') return path;
  }

  const artistName = jamBaseEventArtistName(ev);
  const venueName = jamBaseEventVenueName(ev);
  const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';
  const eventId = jamBaseEventId(ev);

  if (isFeedbackLibraryShow(ev)) {
    const libraryShowId =
      typeof ev['x-feedbackShowId'] === 'string' ? ev['x-feedbackShowId'] : eventId;
    return pastShowClipsPath({
      show_id: libraryShowId,
      jambase_event_id: eventId || null,
      artist_name: artistName,
      venue_name: venueName === 'Venue TBA' ? null : venueName,
      show_date: startDate || null,
      event_title: jamBaseEventTitle(ev),
    });
  }

  const showId =
    eventId ||
    computeShowId({
      jambase_event_id: eventId || null,
      artist_name: artistName,
      venue_name: venueName === 'Venue TBA' ? null : venueName,
      timestamp: startDate,
    });
  return showClipsPath(artistName, showId);
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
  const eventTitle = resolveClipEventTitle(clip);
  // Festival nights are one bill. Artist show ids omit clips that only stored the festival title.
  if (eventTitle && isJamBaseFestivalEvent({ name: eventTitle })) {
    return eventClipsPath(eventTitle);
  }

  const showId = resolveClipShowNavigationId(clip);
  if (clip.artist_name?.trim() && showId) {
    return showClipsPath(clip.artist_name, showId);
  }

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
