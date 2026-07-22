import { normalizeEmail } from './auth-password-utils';

export type OAuthProfileBootstrapInput = {
  email: string;
  /** Provider display name when available (Apple first sign-in, Google profile). */
  displayName?: string | null;
  avatarUrl?: string | null;
};

/** Default display name for new OAuth users: email local-part before `@`. */
export function defaultDisplayNameFromEmail(
  email: string,
  preferredName?: string | null,
): string {
  const fromPreferred = preferredName?.trim();
  if (fromPreferred) {
    return fromPreferred.slice(0, 100);
  }

  const local = normalizeEmail(email).split('@')[0]?.trim();
  if (!local) {
    return 'User';
  }

  return local.slice(0, 100);
}

/**
 * Ensure a `user_profiles` row exists for the signed-in user.
 * No-op when a profile already exists (existing accounts keep their data).
 */
export async function ensureOAuthUserProfile(
  db: D1Database,
  mochaUserId: string,
  input: OAuthProfileBootstrapInput,
): Promise<void> {
  const uid = mochaUserId.trim();
  if (!uid) {
    return;
  }

  const existing = await db
    .prepare('SELECT id FROM user_profiles WHERE mocha_user_id = ?')
    .bind(uid)
    .first<{ id: number }>();

  if (existing) {
    return;
  }

  const email = normalizeEmail(input.email);
  const displayName = defaultDisplayNameFromEmail(email, input.displayName);
  const profileImageUrl = input.avatarUrl?.trim() || null;

  await db
    .prepare(
      `INSERT INTO user_profiles
       (mocha_user_id, role, display_name, bio, location, profile_image_url,
        cover_image_url, city, genres, social_links, created_at, updated_at)
       VALUES (?, 'fan', ?, NULL, NULL, ?, NULL, NULL, '[]', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(uid, displayName, profileImageUrl)
    .run();
}
