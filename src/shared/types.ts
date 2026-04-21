import z from "zod";
import { MochaUser } from "@getmocha/users-service/shared";

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
  is_trending_score: z.number(),
  jambase_artist_id: z.string().nullable().optional(),
  jambase_venue_id: z.string().nullable().optional(),
  jambase_event_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
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
