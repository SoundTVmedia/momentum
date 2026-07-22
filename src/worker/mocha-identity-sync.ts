import type { MochaUser } from '@/shared/mocha-user';
import { normalizeEmail } from './auth-password-utils';
import { upsertUserEmailIndex } from './account-linking';
import { mochaUserIdKey } from './mocha-user-id';

/** Keep Mocha Google users discoverable for Apple/email deduplication. */
export async function syncMochaUserIdentity(
  db: D1Database,
  user: MochaUser,
): Promise<void> {
  const id = mochaUserIdKey(user);
  const email = normalizeEmail(user.email ?? user.google_user_data?.email ?? '');
  if (!id || !email) {
    return;
  }

  const displayName = user.google_user_data?.name?.trim() || null;
  const avatarUrl = user.google_user_data?.picture?.trim() || null;

  try {
    await db
      .prepare(
        `INSERT INTO google_accounts (id, email, display_name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           display_name = COALESCE(excluded.display_name, google_accounts.display_name),
           avatar_url = COALESCE(excluded.avatar_url, google_accounts.avatar_url),
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(id, email, displayName, avatarUrl)
      .run();
  } catch (e) {
    console.warn('syncMochaUserIdentity google_accounts upsert failed', e);
  }

  await upsertUserEmailIndex(db, email, id, 'mocha');
}

export async function ensureGoogleBridgeAccount(
  db: D1Database,
  accountId: string,
  email: string,
  displayName?: string | null,
): Promise<void> {
  const id = accountId.trim();
  const normalizedEmail = normalizeEmail(email);
  if (!id || !normalizedEmail) {
    return;
  }

  const existing = await db
    .prepare('SELECT id FROM google_accounts WHERE id = ?')
    .bind(id)
    .first<{ id: string }>();
  if (existing) {
    await upsertUserEmailIndex(db, normalizedEmail, id, 'google');
    return;
  }

  try {
    await db
      .prepare(
        `INSERT INTO google_accounts (id, email, display_name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(id, normalizedEmail, displayName?.trim() || null)
      .run();
    await upsertUserEmailIndex(db, normalizedEmail, id, 'google');
  } catch (e) {
    console.warn('ensureGoogleBridgeAccount failed', e);
  }
}

/** Ensure an Apple account row exists for a canonical user id (cross-provider sign-in). */
export async function ensureAppleBridgeAccount(
  db: D1Database,
  accountId: string,
  email: string,
  displayName?: string | null,
): Promise<void> {
  const id = accountId.trim();
  const normalizedEmail = normalizeEmail(email);
  if (!id || !normalizedEmail) {
    return;
  }

  const existing = await db
    .prepare('SELECT id FROM apple_accounts WHERE id = ?')
    .bind(id)
    .first<{ id: string }>();
  if (existing) {
    await upsertUserEmailIndex(db, normalizedEmail, id, 'apple');
    return;
  }

  try {
    await db
      .prepare(
        `INSERT INTO apple_accounts (id, email, display_name, is_private_email, created_at, updated_at)
         VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(id, normalizedEmail, displayName?.trim() || null)
      .run();
    await upsertUserEmailIndex(db, normalizedEmail, id, 'apple');
  } catch (e) {
    console.warn('ensureAppleBridgeAccount failed', e);
  }
}
