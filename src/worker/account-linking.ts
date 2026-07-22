import { normalizeEmail } from './auth-password-utils';

type EmailAccountRow = {
  id: string;
  email: string;
  display_name: string | null;
  google_sub: string | null;
  apple_sub?: string | null;
};

export type OAuthAccountRow = {
  id: string;
  email: string;
  display_name: string | null;
};

export type ExistingOAuthAccount =
  | { type: 'email'; account: EmailAccountRow }
  | { type: 'google'; account: OAuthAccountRow }
  | { type: 'apple'; account: OAuthAccountRow }
  | { type: 'indexed'; account: OAuthAccountRow };

const EMAIL_LOOKUP_SQL = (table: string) =>
  `SELECT id, email, display_name FROM ${table} WHERE lower(trim(email)) = ?`;

export async function upsertUserEmailIndex(
  db: D1Database,
  email: string,
  mochaUserId: string,
  source: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const userId = mochaUserId.trim();
  const src = source.trim();
  if (!normalizedEmail || !userId || !src) {
    return;
  }

  try {
    await db
      .prepare(
        `INSERT INTO user_emails (email, mocha_user_id, source, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET
           mocha_user_id = excluded.mocha_user_id,
           source = excluded.source,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(normalizedEmail, userId, src)
      .run();
  } catch (e) {
    console.warn('upsertUserEmailIndex failed', e);
  }
}

export async function findEmailAccountByOAuthEmail(
  db: D1Database,
  email: string,
): Promise<EmailAccountRow | null> {
  const normalized = normalizeEmail(email);
  const row = await db
    .prepare(
      'SELECT id, email, display_name, google_sub, apple_sub FROM email_accounts WHERE lower(trim(email)) = ?',
    )
    .bind(normalized)
    .first<EmailAccountRow>();
  return row ?? null;
}

export async function findEmailAccountByAppleSub(
  db: D1Database,
  appleSub: string,
): Promise<EmailAccountRow | null> {
  const sub = appleSub.trim();
  if (!sub) {
    return null;
  }
  const row = await db
    .prepare(
      'SELECT id, email, display_name, google_sub, apple_sub FROM email_accounts WHERE apple_sub = ?',
    )
    .bind(sub)
    .first<EmailAccountRow>();
  return row ?? null;
}

export async function findEmailAccountByGoogleSub(
  db: D1Database,
  googleSub: string,
): Promise<EmailAccountRow | null> {
  const sub = googleSub.trim();
  if (!sub) {
    return null;
  }
  const row = await db
    .prepare(
      'SELECT id, email, display_name, google_sub, apple_sub FROM email_accounts WHERE google_sub = ?',
    )
    .bind(sub)
    .first<EmailAccountRow>();
  return row ?? null;
}

export async function findEmailAccountByGoogleEmail(
  db: D1Database,
  email: string,
): Promise<EmailAccountRow | null> {
  return findEmailAccountByOAuthEmail(db, email);
}

export async function findGoogleAccountByOAuthEmail(
  db: D1Database,
  email: string,
): Promise<OAuthAccountRow | null> {
  const normalized = normalizeEmail(email);
  const row = await db
    .prepare(EMAIL_LOOKUP_SQL('google_accounts'))
    .bind(normalized)
    .first<OAuthAccountRow>();
  return row ?? null;
}

export async function findAppleAccountByOAuthEmail(
  db: D1Database,
  email: string,
): Promise<OAuthAccountRow | null> {
  const normalized = normalizeEmail(email);
  const row = await db
    .prepare(EMAIL_LOOKUP_SQL('apple_accounts'))
    .bind(normalized)
    .first<OAuthAccountRow>();
  return row ?? null;
}

async function findIndexedAccountByEmail(
  db: D1Database,
  email: string,
): Promise<OAuthAccountRow | null> {
  const normalized = normalizeEmail(email);
  try {
    const row = await db
      .prepare('SELECT mocha_user_id, source FROM user_emails WHERE email = ?')
      .bind(normalized)
      .first<{ mocha_user_id: string; source: string }>();
    if (!row?.mocha_user_id) {
      return null;
    }

    const accountId = row.mocha_user_id.trim();
    const emailRow = await db
      .prepare('SELECT id, email, display_name FROM email_accounts WHERE id = ?')
      .bind(accountId)
      .first<OAuthAccountRow>();
    if (emailRow) {
      return emailRow;
    }

    const googleRow = await db
      .prepare('SELECT id, email, display_name FROM google_accounts WHERE id = ?')
      .bind(accountId)
      .first<OAuthAccountRow>();
    if (googleRow) {
      return googleRow;
    }

    const appleRow = await db
      .prepare('SELECT id, email, display_name FROM apple_accounts WHERE id = ?')
      .bind(accountId)
      .first<OAuthAccountRow>();
    if (appleRow) {
      return appleRow;
    }

    return {
      id: accountId,
      email: normalized,
      display_name: null,
    };
  } catch {
    return null;
  }
}

/**
 * Find an existing app account for an OAuth email across the email index,
 * email/password, Google, and Apple tables.
 */
export async function findExistingAccountByEmail(
  db: D1Database,
  email: string,
): Promise<ExistingOAuthAccount | null> {
  const emailAccount = await findEmailAccountByOAuthEmail(db, email);
  if (emailAccount) {
    return { type: 'email', account: emailAccount };
  }

  const googleAccount = await findGoogleAccountByOAuthEmail(db, email);
  if (googleAccount) {
    return { type: 'google', account: googleAccount };
  }

  const indexedAccount = await findIndexedAccountByEmail(db, email);
  if (indexedAccount) {
    return { type: 'indexed', account: indexedAccount };
  }

  const appleAccount = await findAppleAccountByOAuthEmail(db, email);
  if (appleAccount) {
    return { type: 'apple', account: appleAccount };
  }

  return null;
}

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

export async function linkAppleSubOnEmailAccount(
  db: D1Database,
  emailAccountId: string,
  appleSub: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE email_accounts
       SET apple_sub = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(appleSub, emailAccountId)
    .run();
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
