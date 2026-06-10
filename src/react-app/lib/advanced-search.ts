import type { ClipWithUser } from '@/shared/types';

export type AdvancedSearchPayload = {
  clips: ClipWithUser[];
  artists: {
    name: string;
    image_url: string | null;
    clip_count: number;
    jambase_id?: string | null;
  }[];
  venues: {
    name: string;
    location: string | null;
    clip_count: number;
    image_url?: string | null;
    jambase_id?: string | null;
  }[];
  users: {
    mocha_user_id: string;
    display_name: string | null;
    profile_image_url: string | null;
    clip_count: number;
  }[];
  jambase?: {
    artists: Record<string, unknown>[];
    venues: Record<string, unknown>[];
    events: Record<string, unknown>[];
  };
  /** Set when JamBase could not return live-music results (missing/invalid key, timeout, quota). */
  jambaseNotice?: string | null;
  /** True when results are scoped to a city/state within the user's search radius. */
  locationScoped?: boolean;
  searchGeo?: { label: string; radius_miles: number };
};

export function jamBaseEventTicket(ev: Record<string, unknown>): string | null {
  const offers = ev.offers;
  if (!Array.isArray(offers) || offers.length === 0) {
    return typeof ev.url === 'string' ? ev.url : null;
  }
  const primary = offers.find(
    (o: unknown) =>
      typeof o === 'object' &&
      o !== null &&
      (o as Record<string, unknown>).category === 'ticketingLinkPrimary',
  ) as Record<string, unknown> | undefined;
  const u = (primary?.url ?? (offers[0] as Record<string, unknown>)?.url) as string | undefined;
  return typeof u === 'string' ? u : null;
}

export function advancedSearchHasHits(data: AdvancedSearchPayload | null): boolean {
  if (!data) return false;
  return (
    data.clips.length > 0 ||
    data.artists.length > 0 ||
    data.venues.length > 0 ||
    data.users.length > 0 ||
    (data.jambase !== undefined &&
      (data.jambase.artists.length > 0 ||
        data.jambase.venues.length > 0 ||
        data.jambase.events.length > 0))
  );
}
