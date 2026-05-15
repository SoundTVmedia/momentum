import type { UserProfile } from '@/shared/types';

/**
 * Build the JSON body for POST /api/users/profile without wiping fields when sending a partial update.
 */
export function userProfileToSavePayload(
  profile: UserProfile,
  overrides: Partial<{
    profile_image_url: string | null;
    cover_image_url: string | null;
    display_name: string | null;
    bio: string | null;
    location: string | null;
    city: string | null;
  }> = {},
) {
  let genres: unknown[] = [];
  try {
    const g = profile.genres ? JSON.parse(profile.genres) : [];
    genres = Array.isArray(g) ? g : [];
  } catch {
    genres = [];
  }

  let social_links: Record<string, unknown> = {};
  try {
    const s = profile.social_links ? JSON.parse(profile.social_links) : {};
    social_links = s && typeof s === 'object' && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
  } catch {
    social_links = {};
  }

  return {
    role: profile.role,
    display_name: overrides.display_name !== undefined ? overrides.display_name : profile.display_name,
    bio: overrides.bio !== undefined ? overrides.bio : profile.bio,
    location: overrides.location !== undefined ? overrides.location : profile.location,
    profile_image_url:
      overrides.profile_image_url !== undefined ? overrides.profile_image_url : profile.profile_image_url,
    cover_image_url:
      overrides.cover_image_url !== undefined ? overrides.cover_image_url : profile.cover_image_url,
    city: overrides.city !== undefined ? overrides.city : profile.city,
    genres,
    social_links,
  };
}
