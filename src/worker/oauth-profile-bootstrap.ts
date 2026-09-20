import { normalizeEmail } from './auth-password-utils';

export type OAuthProfileBootstrapInput = {
  email: string;
  /** Provider display name when available (Apple first sign-in, Google profile). */
  displayName?: string | null;
  avatarUrl?: string | null;
};

export function isEmailLocalPartName(
  displayName: string | null | undefined,
  email: string,
): boolean {
  const name = displayName?.trim().toLowerCase();
  if (!name) {
    return true;
  }
  const local = normalizeEmail(email).split('@')[0]?.trim().toLowerCase();
  return Boolean(local) && name === local;
}

/** Provider-supplied name, ignoring email local-part placeholders. */
export function preferredProviderDisplayName(
  preferredName?: string | null,
  email?: string | null,
): string | null {
  const fromPreferred = preferredName?.trim();
  if (!fromPreferred) {
    return null;
  }
  const clipped = fromPreferred.slice(0, 100);
  if (email && isEmailLocalPartName(clipped, email)) {
    return null;
  }
  return clipped;
}

/** @deprecated Use preferredProviderDisplayName — do not fall back to the email local-part. */
export function defaultDisplayNameFromEmail(
  email: string,
  preferredName?: string | null,
): string {
  return preferredProviderDisplayName(preferredName, email) || 'User';
}

async function lookupAuthTableDisplayName(
  db: D1Database,
  mochaUserId: string,
  email: string,
): Promise<string | null> {
  const tables = ['apple_accounts', 'google_accounts', 'email_accounts'] as const;
  for (const table of tables) {
    const row = await db
      .prepare(`SELECT display_name, email FROM ${table} WHERE id = ?`)
      .bind(mochaUserId)
      .first<{ display_name: string | null; email: string | null }>();
    const name = preferredProviderDisplayName(row?.display_name, row?.email || email);
    if (name) {
      return name;
    }
  }
  return null;
}

/**
 * Ensure a `user_profiles` row exists for the signed-in user.
 * If the stored name is missing or the email local-part, upgrade it to the
 * Apple/Google/email display name when we have one.
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

  const email = normalizeEmail(input.email);
  const fromInput = preferredProviderDisplayName(input.displayName, email);
  const fromAuthTables = fromInput
    ? null
    : await lookupAuthTableDisplayName(db, uid, email);
  const providerName = fromInput || fromAuthTables;
  const profileImageUrl = input.avatarUrl?.trim() || null;

  const existing = await db
    .prepare('SELECT id, display_name FROM user_profiles WHERE mocha_user_id = ?')
    .bind(uid)
    .first<{ id: number; display_name: string | null }>();

  if (existing) {
    if (providerName && isEmailLocalPartName(existing.display_name, email)) {
      await db
        .prepare(
          `UPDATE user_profiles
           SET display_name = ?, updated_at = CURRENT_TIMESTAMP
           WHERE mocha_user_id = ?`,
        )
        .bind(providerName, uid)
        .run();
    }
    return;
  }

  await db
    .prepare(
      `INSERT INTO user_profiles
       (mocha_user_id, role, display_name, bio, location, profile_image_url,
        cover_image_url, city, genres, social_links, created_at, updated_at)
       VALUES (?, 'fan', ?, NULL, NULL, ?, NULL, NULL, '[]', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(uid, providerName || 'User', profileImageUrl)
    .run();
}
