import type { ExtendedMochaUser } from '@/shared/types';

export function isSuperAdminUser(user: ExtendedMochaUser | null | undefined): boolean {
  return user?.profile?.is_superadmin === 1;
}

export function showAmbassadorNav(user: ExtendedMochaUser | null | undefined): boolean {
  if (!user?.profile) return false;
  return user.profile.role === 'ambassador' || isSuperAdminUser(user);
}

export function showInfluencerNav(user: ExtendedMochaUser | null | undefined): boolean {
  if (!user?.profile) return false;
  return user.profile.role === 'influencer' || isSuperAdminUser(user);
}

export function showSponsorNav(user: ExtendedMochaUser | null | undefined): boolean {
  if (!user?.profile) return false;
  return user.profile.role === 'sponsor' || isSuperAdminUser(user);
}

export function showBecomeAmbassadorItem(
  user: ExtendedMochaUser | null | undefined,
): boolean {
  if (!user?.profile) return false;
  return user.profile.role !== 'ambassador';
}

export function showBecomeInfluencerItem(
  user: ExtendedMochaUser | null | undefined,
): boolean {
  if (!user?.profile) return false;
  return user.profile.role !== 'influencer';
}

export function showBecomeNav(user: ExtendedMochaUser | null | undefined): boolean {
  return showBecomeAmbassadorItem(user) || showBecomeInfluencerItem(user);
}

export function canAccessAmbassadorHub(user: ExtendedMochaUser | null | undefined): boolean {
  return showAmbassadorNav(user);
}

export function canAccessInfluencerHub(user: ExtendedMochaUser | null | undefined): boolean {
  return showInfluencerNav(user);
}

/** Superadmins see program rosters; role holders see their own dashboard. */
export function ambassadorHubMode(
  user: ExtendedMochaUser | null | undefined,
): 'roster' | 'dashboard' | 'denied' {
  if (!user?.profile) return 'denied';
  if (isSuperAdminUser(user)) return 'roster';
  if (user.profile.role === 'ambassador') return 'dashboard';
  return 'denied';
}

export function influencerHubMode(
  user: ExtendedMochaUser | null | undefined,
): 'roster' | 'dashboard' | 'denied' {
  if (!user?.profile) return 'denied';
  if (isSuperAdminUser(user)) return 'roster';
  if (user.profile.role === 'influencer') return 'dashboard';
  return 'denied';
}
