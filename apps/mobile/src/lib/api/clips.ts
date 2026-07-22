import { API_BASE_URL } from '@/src/config/env';
import { apiJson } from '@/src/lib/api/client';
import type {
  ClipsPage,
  DiscoverFeedResponse,
  FavoriteArtistFeedResponse,
  FriendsGoingResponse,
  NotificationsResponse,
  PointsResponse,
  ShowEvent,
  ShowMarksResponse,
  ShowsResponse,
} from '@/src/lib/api/types';
import {
  resolveClipPosterUrl as sharedPosterUrl,
  resolveModalPlaybackSource as sharedModalSource,
  type ClipPlaybackFields,
  type ModalPlaybackSource,
} from '@shared/clip-playback';

export type AdvancedSearchPayload = {
  clips: ClipsPage['clips'];
  artists: Array<{
    name: string;
    image_url?: string | null;
    clip_count?: number;
  }>;
  venues: Array<{
    name: string;
    location?: string | null;
    clip_count?: number;
  }>;
  jambaseNotice?: string | null;
};

export async function fetchAdvancedSearch(
  q: string,
  opts?: { compact?: boolean; signal?: AbortSignal },
): Promise<AdvancedSearchPayload> {
  const params = new URLSearchParams({ q: q.trim() });
  if (opts?.compact) params.set('compact', '1');
  return apiJson<AdvancedSearchPayload>(`/api/search/advanced?${params.toString()}`, {
    signal: opts?.signal,
  });
}

function absoluteMediaUrl(url: string | null | undefined): string {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return u;
}

export function resolveClipPosterUrl(clip: ClipPlaybackFields): string {
  return absoluteMediaUrl(sharedPosterUrl(clip));
}

export function resolveModalPlaybackSource(clip: ClipPlaybackFields): ModalPlaybackSource {
  const source = sharedModalSource(clip);
  return {
    ...source,
    src: absoluteMediaUrl(source.src),
    poster: absoluteMediaUrl(source.poster),
    hlsFallbackSrc: source.hlsFallbackSrc
      ? absoluteMediaUrl(source.hlsFallbackSrc)
      : source.hlsFallbackSrc,
  };
}

export async function fetchClipsPage(opts: {
  page?: number;
  limit?: number;
  sortBy?: 'latest' | 'most_liked' | 'most_viewed';
  artistName?: string;
  venueName?: string;
}): Promise<ClipsPage> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 12;
  const sortBy = opts.sortBy ?? 'latest';
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort_by: sortBy,
  });
  if (opts.artistName?.trim()) qs.set('artist_name', opts.artistName.trim());
  if (opts.venueName?.trim()) qs.set('venue_name', opts.venueName.trim());
  return apiJson<ClipsPage>(`/api/clips?${qs.toString()}`);
}

export async function fetchDiscoverFeed(): Promise<DiscoverFeedResponse> {
  return apiJson<DiscoverFeedResponse>('/api/discover/feed');
}

export async function fetchNearbyShows(opts: {
  latitude: number;
  longitude: number;
  limit?: number;
  radiusMiles?: number;
}): Promise<ShowsResponse> {
  const qs = new URLSearchParams({
    latitude: String(opts.latitude),
    longitude: String(opts.longitude),
    limit: String(opts.limit ?? 40),
  });
  if (opts.radiusMiles != null) {
    qs.set('radius_miles', String(opts.radiusMiles));
  }
  return apiJson<ShowsResponse>(`/api/shows/nearby?${qs.toString()}`);
}

export async function fetchTonightShows(opts: {
  latitude: number;
  longitude: number;
  limit?: number;
}): Promise<ShowsResponse> {
  const qs = new URLSearchParams({
    latitude: String(opts.latitude),
    longitude: String(opts.longitude),
    limit: String(opts.limit ?? 40),
  });
  return apiJson<ShowsResponse>(`/api/shows/tonight?${qs.toString()}`);
}

export async function fetchSavedClips(): Promise<{ clips: ClipsPage['clips'] }> {
  return apiJson('/api/users/me/saved-clips');
}

export async function fetchLikedClipsFeed(): Promise<{ clips: ClipsPage['clips'] }> {
  return apiJson('/api/users/me/liked-clips-feed');
}

export async function fetchMyClips(opts?: {
  page?: number;
  limit?: number;
}): Promise<ClipsPage> {
  const qs = new URLSearchParams({
    page: String(opts?.page ?? 1),
    limit: String(opts?.limit ?? 24),
    sort_by: 'latest',
    content_feed: 'main',
  });
  return apiJson<ClipsPage>(`/api/me/clips?${qs.toString()}`);
}

export async function fetchFavoriteArtistFeed(opts?: {
  clipsLimit?: number;
  clipsOffset?: number;
}): Promise<FavoriteArtistFeedResponse> {
  const qs = new URLSearchParams({
    events_limit: '0',
    clips_limit: String(opts?.clipsLimit ?? 24),
    clips_offset: String(opts?.clipsOffset ?? 0),
  });
  return apiJson<FavoriteArtistFeedResponse>(
    `/api/discover/favorite-artist-feed?${qs.toString()}`,
  );
}

export async function fetchMyGoingShowMarks(): Promise<ShowMarksResponse> {
  return apiJson<ShowMarksResponse>(
    '/api/users/me/show-marks?status=going&enrich=jambase',
  );
}

export async function fetchFriendsGoing(): Promise<FriendsGoingResponse> {
  return apiJson<FriendsGoingResponse>('/api/shows/friends-going?limit=40');
}

export async function fetchMyPoints(): Promise<PointsResponse> {
  return apiJson<PointsResponse>('/api/gamification/points');
}

export async function fetchJamBaseEventsByArtistName(
  artistName: string,
  perPage = 12,
): Promise<{ events: ShowEvent[]; notice?: string | null }> {
  const qs = new URLSearchParams({
    artistName: artistName.trim(),
    perPage: String(perPage),
  });
  const data = await apiJson<{
    events?: ShowEvent[];
    notice?: string | null;
  }>(`/api/jambase/events/by-artist-name?${qs.toString()}`);
  return { events: data.events ?? [], notice: data.notice ?? null };
}

export async function fetchJamBaseEventsByVenueName(
  venueName: string,
  perPage = 12,
): Promise<{ events: ShowEvent[]; notice?: string | null }> {
  const qs = new URLSearchParams({
    venueName: venueName.trim(),
    perPage: String(perPage),
  });
  const data = await apiJson<{
    events?: ShowEvent[];
    notice?: string | null;
  }>(`/api/jambase/events/by-venue-name?${qs.toString()}`);
  return { events: data.events ?? [], notice: data.notice ?? null };
}

export type ArtistPagePayload = {
  artist: {
    id: number;
    name: string;
    bio: string | null;
    image_url: string | null;
    social_links: string | null;
    is_verified: number;
  } | null;
  clips: ClipsPage['clips'];
  tourDates: Array<{
    id: number;
    date: string;
    city: string | null;
    country: string | null;
    ticket_url: string | null;
    venue_name: string | null;
    venue_location: string | null;
  }>;
  jambase_attribution?: boolean;
};

export type VenuePagePayload = {
  venue: {
    id: number;
    name: string;
    location: string | null;
    address: string | null;
    image_url: string | null;
    capacity: number | null;
  };
  clips: ClipsPage['clips'];
  upcomingEvents: Array<{
    id: number;
    date: string;
    city: string | null;
    country: string | null;
    ticket_url: string | null;
    artist_name: string | null;
    artist_image: string | null;
  }>;
  upcomingJamBaseEvents?: Record<string, unknown>[] | null;
  jambase_attribution?: boolean;
};

export async function fetchArtistPage(artistSlug: string): Promise<ArtistPagePayload> {
  return apiJson<ArtistPagePayload>(`/api/artists/${encodeURIComponent(artistSlug)}`);
}

export async function fetchVenuePage(venueSlug: string): Promise<VenuePagePayload> {
  return apiJson<VenuePagePayload>(`/api/venues/${encodeURIComponent(venueSlug)}`);
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return apiJson<NotificationsResponse>('/api/notifications');
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiJson('/api/notifications/read-all', { method: 'POST' });
}
