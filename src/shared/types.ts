import z from "zod";
import type { MochaUser } from './mocha-user';
export type { MochaUser } from './mocha-user';

export const UserRoleSchema = z.enum(['fan', 'artist', 'venue', 'ambassador', 'influencer', 'premium']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserProfileSchema = z.object({
  id: z.number(),
  mocha_user_id: z.string(),
  role: UserRoleSchema,
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  profile_image_url: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  city: z.string().nullable(),
  genres: z.string().nullable(), // JSON array stored as string
  social_links: z.string().nullable(), // JSON object stored as string
  is_verified: z.number().int(), // 0 or 1
  is_premium: z.number().int(), // 0 or 1
  is_admin: z.number().int().optional(), // 0 or 1
  is_moderator: z.number().int().optional(), // 0 or 1
  commission_rate: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  /** JSON array of artist display names (personalization / favorite artists feed) */
  favorite_artists: z.string().nullable().optional(),
  home_location: z.string().nullable().optional(),
  home_latitude: z.number().nullable().optional(),
  home_longitude: z.number().nullable().optional(),
  location_radius_miles: z.number().nullable().optional(),
  personalization_enabled: z.number().int().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export interface ExtendedMochaUser extends MochaUser {
  profile: UserProfile | null;
}

export const ClipSchema = z.object({
  id: z.number(),
  mocha_user_id: z.string(),
  artist_name: z.string().nullable(),
  venue_name: z.string().nullable(),
  location: z.string().nullable(),
  timestamp: z.string().nullable(),
  content_description: z.string().nullable(),
  video_url: z.string(),
  thumbnail_url: z.string().nullable(),
  likes_count: z.number().int(),
  comments_count: z.number().int(),
  views_count: z.number().int(),
  hashtags: z.string().nullable(), // JSON array stored as string
  song_title: z.string().nullable().optional(),
  song_slug: z.string().nullable().optional(),
  genre_name: z.string().nullable().optional(),
  genre_slug: z.string().nullable().optional(),
  is_trending_score: z.number(),
  jambase_artist_id: z.string().nullable().optional(),
  jambase_venue_id: z.string().nullable().optional(),
  jambase_event_id: z.string().nullable().optional(),
  event_title: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  recording_orientation: z.string().nullable().optional(),
  video_resolution_w: z.number().int().nullable().optional(),
  video_resolution_h: z.number().int().nullable().optional(),
  stream_video_id: z.string().nullable().optional(),
  stream_playback_url: z.string().nullable().optional(),
  stream_thumbnail_url: z.string().nullable().optional(),
});

export type Clip = z.infer<typeof ClipSchema>;

export const ClipWithUserSchema = ClipSchema.extend({
  user_display_name: z.string().nullable(),
  user_avatar: z.string().nullable(),
  momentum_live_featured: z.boolean().optional(),
});

export type ClipWithUser = z.infer<typeof ClipWithUserSchema>;

// JamBase API Types
export interface JamBaseArtist {
  identifier: string;
  name: string;
  description?: string;
  image?: string;
  url?: string;
}

export interface JamBaseVenue {
  identifier: string;
  name: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  address?: string;
  capacity?: number;
  url?: string;
}

export interface JamBaseEvent {
  identifier: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  artists?: JamBaseArtist[];
  venue?: JamBaseVenue;
  ticketUrl?: string;
  image?: string;
}

/** Server /api/clips/resolve-show candidate (venue from GPS; artist/event when a same-day JamBase show matched). */
export interface ClipShowCandidate {
  /** Present when the row came from an event; null for closest-venue-only matches. */
  jambase_event_id: string | null;
  jambase_artist_id: string | null;
  jambase_venue_id: string | null;
  artist_name: string | null;
  venue_name: string | null;
  location: string | null;
  /** JamBase event name when matched, e.g. "Don Toliver at Colonial Life Arena". */
  event_title: string | null;
  startDate: string;
  distance_miles: number | null;
}

export interface ClipShowResolveResponse {
  match: 'none' | 'single' | 'ambiguous';
  candidates: ClipShowCandidate[];
  /** Closest plausible venues by distance (for pickers); not tied to `match`. */
  nearbyVenues?: ClipShowCandidate[];
  notice?: string;
  meta?: {
    radiusMiles: number;
    geoCityId: string | null;
    eventDateFrom: string;
  };
}
