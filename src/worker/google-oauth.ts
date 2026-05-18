import type { Context } from 'hono';
import * as crypto from 'crypto';
import { setCookie, getCookie } from 'hono/cookie';
import type { MochaUser } from '@getmocha/users-service/shared';
import { normalizeOAuthCallbackUrl } from '../shared/oauth-redirect';
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function hashOpaqueToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function isLocalDevHost(c: Context<{ Bindings: Env }>): boolean {
  const host = (c.req.header('host') || '').toLowerCase().split(':')[0];
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local')
  ) {
    return true;
  }
  const forwardedProto = (c.req.header('x-forwarded-proto') || '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  let proto = forwardedProto;
  if (!proto) {
    try {
      proto = new URL(c.req.url).protocol.replace(':', '').toLowerCase();
    } catch {
      proto = '';
    }
  }
  if (proto === 'https') {
    return false;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
}

export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export function hasDirectGoogleOAuth(env: Env): boolean {
  const id = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}

export function resolveOAuthCallbackUrl(
  c: Context<{ Bindings: Env }>,
  redirectBaseQuery?: string,
): string {
  const fromQuery = redirectBaseQuery?.trim();
  if (fromQuery) {
    return normalizeOAuthCallbackUrl(fromQuery);
  }
  const fromEnv =
    typeof c.env.MOCHA_OAUTH_REDIRECT_ORIGIN === 'string'
      ? c.env.MOCHA_OAUTH_REDIRECT_ORIGIN.trim()
      : '';
  if (fromEnv) {
    return normalizeOAuthCallbackUrl(fromEnv);
  }
  const origin = c.req.header('origin')?.trim();
  if (origin) {
    return normalizeOAuthCallbackUrl(origin);
  }
  try {
    return normalizeOAuthCallbackUrl(new URL(c.req.url).origin);
  } catch {
    return normalizeOAuthCallbackUrl('');
  }
}

function oauthStateCookieOptions(c: Context<{ Bindings: Env }>) {
  const local = isLocalDevHost(c);
  return {
    httpOnly: true,
    path: '/',
    sameSite: (local ? 'lax' : 'none') as 'lax' | 'none',
    secure: !local,
    maxAge: 10 * 60,
  };
}

export function buildGoogleOAuthRedirectUrl(
  c: Context<{ Bindings: Env }>,
  redirectUri: string,
): string {
  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID!.trim();
  const state = crypto.randomBytes(24).toString('hex');
  setCookie(
    c,
    GOOGLE_OAUTH_STATE_COOKIE,
    JSON.stringify({ state, redirectUri }),
    oauthStateCookieOptions(c),
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export function googleAccountToMochaUser(row: {
  id: string;
  email: string;
  display_name: string | null;
}): MochaUser {
  const name = row.display_name?.trim() || row.email.split('@')[0] || 'User';
  return {
    id: row.id,
    email: row.email,
    google_sub: row.id,
    google_user_data: {
      email: row.email,
      email_verified: true,
      name,
      picture: undefined,
      sub: row.id,
    },
    last_signed_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertGoogleAccount(
  db: D1Database,
  info: GoogleUserInfo,
): Promise<{ id: string; email: string; display_name: string | null }> {
  const sub = info.sub?.trim();
  const email = info.email?.trim().toLowerCase();
  if (!sub || !email) {
    throw new Error('Google account is missing required profile fields');
  }

  const displayName = info.name?.trim() || null;
  const avatarUrl = info.picture?.trim() || null;

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
    .bind(sub, email, displayName, avatarUrl)
    .run();

  const row = await db
    .prepare('SELECT id, email, display_name FROM google_accounts WHERE id = ?')
    .bind(sub)
    .first<{ id: string; email: string; display_name: string | null }>();

  if (!row) {
    throw new Error('Could not persist Google account');
  }
  return row;
}

async function createGoogleSession(
  db: D1Database,
  userId: string,
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_MAX_AGE_SEC);

  await db
    .prepare(
      `INSERT INTO google_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
    )
    .bind(userId, tokenHash, expiresAt.toISOString())
    .run();

  return rawToken;
}

export async function exchangeGoogleOAuthCode(
  c: Context<{ Bindings: Env }>,
  code: string,
  stateFromQuery?: string | null,
): Promise<string> {
  const stateRaw = getCookie(c, GOOGLE_OAUTH_STATE_COOKIE);
  if (!stateRaw) {
    throw new Error('OAuth session expired. Please try signing in again.');
  }

  let parsed: { state?: string; redirectUri?: string };
  try {
    parsed = JSON.parse(stateRaw) as { state?: string; redirectUri?: string };
  } catch {
    throw new Error('Invalid OAuth state');
  }

  if (!parsed.state || !parsed.redirectUri || parsed.state !== stateFromQuery) {
    throw new Error('OAuth state mismatch. Please try signing in again.');
  }

  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID!.trim();
  const clientSecret = c.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim();

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: parsed.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error('Google token exchange failed', tokenRes.status, tokenJson);
    throw new Error(
      tokenJson.error_description ||
        tokenJson.error ||
        'Google sign-in could not be completed',
    );
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const userInfo = (await userRes.json()) as GoogleUserInfo;
  if (!userRes.ok || !userInfo.sub) {
    console.error('Google userinfo failed', userRes.status, userInfo);
    throw new Error('Could not load your Google profile');
  }

  const account = await upsertGoogleAccount(c.env.DB, userInfo);
  return createGoogleSession(c.env.DB, account.id);
}

export async function validateGoogleSession(
  db: D1Database,
  rawToken: string,
): Promise<MochaUser | null> {
  const tokenHash = hashOpaqueToken(rawToken);
  const session = await db
    .prepare(
      `SELECT google_sessions.user_id, google_sessions.expires_at
       FROM google_sessions
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string }>();

  if (!session) {
    return null;
  }
  if (new Date(session.expires_at) <= new Date()) {
    await db
      .prepare('DELETE FROM google_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();
    return null;
  }

  const account = await db
    .prepare(
      'SELECT id, email, display_name, avatar_url FROM google_accounts WHERE id = ?',
    )
    .bind(session.user_id)
    .first<{
      id: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
    }>();

  if (!account) {
    return null;
  }
  const user = googleAccountToMochaUser(account);
  if (account.avatar_url) {
    user.google_user_data.picture = account.avatar_url;
  }
  return user;
}

export async function revokeGoogleSession(db: D1Database, rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);
  await db
    .prepare('DELETE FROM google_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}
