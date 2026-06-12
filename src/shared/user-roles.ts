import type { UserRole } from './types';

/** Roles users can hold in the community (assigned manually by staff). */
export const COMMUNITY_ROLES = [
  'fan',
  'artist',
  'venue',
  'ambassador',
  'influencer',
  'sponsor',
  'premium',
] as const satisfies readonly UserRole[];

export type CommunityRole = (typeof COMMUNITY_ROLES)[number];

export const COMMUNITY_ROLE_LABELS: Record<CommunityRole, string> = {
  fan: 'Fan',
  artist: 'Artist',
  venue: 'Venue',
  ambassador: 'Ambassador',
  influencer: 'Influencer',
  sponsor: 'Sponsor',
  premium: 'Premium',
};

export function isCommunityRole(value: string): value is CommunityRole {
  return (COMMUNITY_ROLES as readonly string[]).includes(value);
}
