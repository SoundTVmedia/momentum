import { normalizeEmail } from './auth-password-utils';

type EmailAccountRow = {
  id: string;
  email: string;
  display_name: string | null;
  google_sub: string | null;
};

/** Tables with a single `mocha_user_id` column to re-point when merging identities. */
export const MOCHA_USER_ID_TABLES = [
  'notifications',
  'saved_clips',
  'clip_likes',
  'user_points',
  'point_transactions',
  'user_badges',
  'two_factor_auth',
  'subscriptions',
  'user_favorite_artists',
  'user_favorite_clips_by_artist',
  'user_device_tokens',
  'daily_active_users',
  'verification_requests',
  'clip_ratings',
  'user_bans',
  'user_privacy_settings',
  'account_deletion_requests',
  'payout_requests',
  'transactions',
] as const;

export async function findEmailAccountByGoogleEmail(
  db: D1Database,
  email: string,
): Promise<EmailAccountRow | null> {
  const normalized = normalizeEmail(email);
  const row = await db
    .prepare(
      'SELECT id, email, display_name, google_sub FROM email_accounts WHERE email = ?',
    )
    .bind(normalized)
    .first<EmailAccountRow>();
  return row ?? null;
}

export async function linkGoogleSubOnEmailAccount(
  db: D1Database,
  emailAccountId: string,
  googleSub: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE email_accounts
       SET google_sub = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(googleSub, emailAccountId)
    .run();
}

/**
 * Move app data from a Google-only `mocha_user_id` (Google `sub`) to the canonical
 * email-account id so profile, clips, and preferences stay on one user.
 */
export async function reassignMochaUserId(
  db: D1Database,
  fromId: string,
  toId: string,
): Promise<void> {
  if (!fromId || !toId || fromId === toId) {
    return;
  }

  const destProfile = await db
    .prepare('SELECT id FROM user_profiles WHERE mocha_user_id = ?')
    .bind(toId)
    .first<{ id: number }>();
  const srcProfile = await db
    .prepare('SELECT id FROM user_profiles WHERE mocha_user_id = ?')
    .bind(fromId)
    .first<{ id: number }>();

  if (srcProfile && !destProfile) {
    await db
      .prepare('UPDATE user_profiles SET mocha_user_id = ? WHERE mocha_user_id = ?')
      .bind(toId, fromId)
      .run();
  } else if (srcProfile && destProfile) {
    await db
      .prepare('DELETE FROM user_profiles WHERE mocha_user_id = ?')
      .bind(fromId)
      .run();
  }

  for (const table of MOCHA_USER_ID_TABLES) {
    try {
      await db
        .prepare(`UPDATE ${table} SET mocha_user_id = ? WHERE mocha_user_id = ?`)
        .bind(toId, fromId)
        .run();
    } catch (e) {
      console.warn(`reassignMochaUserId: could not update ${table}`, e);
    }
  }

  try {
    await db
      .prepare(
        'UPDATE follows SET follower_id = ? WHERE follower_id = ?',
      )
      .bind(toId, fromId)
      .run();
    await db
      .prepare(
        'UPDATE follows SET following_id = ? WHERE following_id = ?',
      )
      .bind(toId, fromId)
      .run();
  } catch (e) {
    console.warn('reassignMochaUserId: could not update follows', e);
  }

  try {
    await db
      .prepare('UPDATE clips SET mocha_user_id = ? WHERE mocha_user_id = ?')
      .bind(toId, fromId)
      .run();
    await db
      .prepare('UPDATE comments SET mocha_user_id = ? WHERE mocha_user_id = ?')
      .bind(toId, fromId)
      .run();
  } catch (e) {
    console.warn('reassignMochaUserId: could not update clips/comments', e);
  }
}
