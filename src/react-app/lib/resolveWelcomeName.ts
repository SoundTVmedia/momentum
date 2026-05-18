import type { ExtendedMochaUser } from '@/shared/types';

function firstWordFromFullName(full: string): string | null {
  const w = full.trim().split(/\s+/)[0];
  if (!w) return null;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** First segment of the email local-part (e.g. `john.doe+tag` → `John`). */
function firstNameFromEmailLocal(email: string | null | undefined): string | null {
  if (!email?.includes('@')) return null;
  const local = email.split('@')[0]?.trim().split('+')[0];
  if (!local) return null;
  const token = local.split(/[._-]/)[0];
  if (!token || !/^[a-zA-Z]/.test(token)) return null;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Profile display name, OAuth name, or email-derived first name. */
export function resolveWelcomeName(u: ExtendedMochaUser | null): string | null {
  if (!u) return null;
  const profile = u.profile?.display_name?.trim();
  if (profile) return profile;
  const top = (u as { display_name?: string | null }).display_name?.trim();
  if (top) return top;
  const google = (u as { google_user_data?: { name?: string } }).google_user_data?.name;
  const fromGoogle = google ? firstWordFromFullName(google) : null;
  if (fromGoogle) return fromGoogle;
  const email = (u as { email?: string | null }).email;
  return firstNameFromEmailLocal(email);
}
