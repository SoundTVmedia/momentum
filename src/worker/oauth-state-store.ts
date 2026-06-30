import * as nodeCrypto from 'node:crypto';

const OAUTH_STATE_TTL_SEC = 10 * 60;

export async function saveOAuthPendingState(
  db: D1Database,
  state: string,
  provider: 'google' | 'apple',
  redirectUri: string,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + OAUTH_STATE_TTL_SEC);
  await db
    .prepare(
      `INSERT INTO oauth_pending_states (state, provider, redirect_uri, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(state) DO UPDATE SET
         provider = excluded.provider,
         redirect_uri = excluded.redirect_uri,
         expires_at = excluded.expires_at`,
    )
    .bind(state, provider, redirectUri, expiresAt.toISOString())
    .run();
}

export async function consumeOAuthPendingState(
  db: D1Database,
  state: string,
  provider: 'google' | 'apple',
): Promise<{ state: string; redirectUri: string } | null> {
  const row = await db
    .prepare(
      `SELECT state, redirect_uri, expires_at
       FROM oauth_pending_states
       WHERE state = ? AND provider = ?`,
    )
    .bind(state, provider)
    .first<{ state: string; redirect_uri: string; expires_at: string }>();

  if (!row) {
    return null;
  }

  await db
    .prepare('DELETE FROM oauth_pending_states WHERE state = ?')
    .bind(state)
    .run();

  if (new Date(row.expires_at) <= new Date()) {
    return null;
  }

  return { state: row.state, redirectUri: row.redirect_uri };
}

export function createOAuthStateToken(): string {
  return nodeCrypto.randomBytes(24).toString('hex');
}
