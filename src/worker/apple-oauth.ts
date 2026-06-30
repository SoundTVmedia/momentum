import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import * as nodeCrypto from 'node:crypto';
import type { MochaUser } from '@/shared/mocha-user';
import {
  APPLE_OAUTH_CALLBACK_PATH,
  resolveAppleOAuthCallbackUrl,
} from '../shared/oauth-redirect';
import { normalizeEmail } from './auth-password-utils';
import {
  findEmailAccountByOAuthEmail,
  linkAppleSubOnEmailAccount,
  reassignMochaUserId,
} from './account-linking';
import { createAppleClientSecret, verifyAppleJwt } from './apple-jwt';
import { hashOpaqueToken, isLocalDevHost } from './hybrid-auth';

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;
export const APPLE_OAUTH_STATE_COOKIE = 'apple_oauth_state';
export const APPLE_SESSION_COOKIE_NAME = 'momentum_apple_session';

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';

export function hasDirectAppleOAuth(env: Env): boolean {
  const servicesId = env.APPLE_SERVICES_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const key = env.APPLE_PRIVATE_KEY?.trim();
  return Boolean(servicesId && teamId && keyId && key);
}

function readRedirectFromQuery(c: Context<{ Bindings: Env }>): string | undefined {
  const raw =
    c.req.query('redirect_uri')?.trim() || c.req.query('redirect_base')?.trim();
  return raw || undefined;
}

export function resolveAppleCallbackUrl(
  c: Context<{ Bindings: Env }>,
  redirectBaseQuery?: string,
): string {
  const fromQuery = redirectBaseQuery?.trim() || readRedirectFromQuery(c);
  if (fromQuery) {
    return resolveAppleOAuthCallbackUrl(fromQuery);
  }

  const explicit =
    typeof c.env.OAUTH_REDIRECT_URI === 'string'
      ? c.env.OAUTH_REDIRECT_URI.trim()
      : '';
  if (explicit) {
    try {
      return resolveAppleOAuthCallbackUrl(new URL(explicit).origin);
    } catch {
      /* fall through */
    }
  }

  const publicApp =
    typeof c.env.PUBLIC_APP_URL === 'string' ? c.env.PUBLIC_APP_URL.trim() : '';
  if (publicApp) {
    return resolveAppleOAuthCallbackUrl(publicApp);
  }

  const origin = c.req.header('origin')?.trim();
  if (origin) {
    return resolveAppleOAuthCallbackUrl(origin);
  }

  try {
    return resolveAppleOAuthCallbackUrl(new URL(c.req.url).origin);
  } catch {
    return APPLE_OAUTH_CALLBACK_PATH;
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

export function buildAppleOAuthRedirectUrl(
  c: Context<{ Bindings: Env }>,
  redirectUri: string,
): string {
  const clientId = c.env.APPLE_SERVICES_ID!.trim();
  const state = nodeCrypto.randomBytes(24).toString('hex');
  setCookie(
    c,
    APPLE_OAUTH_STATE_COOKIE,
    JSON.stringify({ state, redirectUri }),
    oauthStateCookieOptions(c),
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });

  return `${APPLE_AUTH_URL}?${params.toString()}`;
}

export type AppleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  is_private_email?: boolean;
  name?: string | null;
};

type AppleTokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

export function appleAccountToMochaUser(row: {
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
      picture: null,
      sub: row.id,
    },
    last_signed_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertAppleAccount(
  db: D1Database,
  info: AppleUserInfo,
): Promise<{ id: string; email: string; display_name: string | null }> {
  const sub = info.sub.trim();
  const email = normalizeEmail(info.email);
  if (!sub || !email) {
    throw new Error('Apple account is missing required profile fields');
  }

  const displayName = info.name?.trim() || null;
  const isPrivate = info.is_private_email ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO apple_accounts (id, email, display_name, is_private_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = COALESCE(excluded.display_name, apple_accounts.display_name),
         is_private_email = excluded.is_private_email,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(sub, email, displayName, isPrivate)
    .run();

  const row = await db
    .prepare('SELECT id, email, display_name FROM apple_accounts WHERE id = ?')
    .bind(sub)
    .first<{ id: string; email: string; display_name: string | null }>();

  if (!row) {
    throw new Error('Could not persist Apple account');
  }
  return row;
}

async function createAppleSession(db: D1Database, userId: string): Promise<string> {
  const rawToken = nodeCrypto.randomBytes(32).toString('hex');
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_MAX_AGE_SEC);

  await db
    .prepare(
      `INSERT INTO apple_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
    )
    .bind(userId, tokenHash, expiresAt.toISOString())
    .run();

  return rawToken;
}

async function createEmailSessionToken(db: D1Database, userId: string): Promise<string> {
  const rawToken = nodeCrypto.randomBytes(32).toString('hex');
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_MAX_AGE_SEC);

  await db
    .prepare(
      `INSERT INTO email_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
    )
    .bind(userId, tokenHash, expiresAt.toISOString())
    .run();

  return rawToken;
}

export type AppleSignInResult = {
  sessionToken: string;
  sessionType: 'apple' | 'email';
};

export async function resolveAppleSignInSession(
  db: D1Database,
  info: AppleUserInfo,
): Promise<AppleSignInResult> {
  const sub = info.sub.trim();
  const email = info.email.trim();
  if (!sub || !email) {
    throw new Error('Apple account is missing required profile fields');
  }

  const emailAccount = await findEmailAccountByOAuthEmail(db, email);
  if (emailAccount) {
    await linkAppleSubOnEmailAccount(db, emailAccount.id, sub);
    await reassignMochaUserId(db, sub, emailAccount.id);
    await upsertAppleAccount(db, info);
    const sessionToken = await createEmailSessionToken(db, emailAccount.id);
    return { sessionToken, sessionType: 'email' };
  }

  const account = await upsertAppleAccount(db, info);
  const sessionToken = await createAppleSession(db, account.id);
  return { sessionToken, sessionType: 'apple' };
}

function parseAppleUserName(userJson: string | null | undefined): string | null {
  if (!userJson?.trim()) return null;
  try {
    const parsed = JSON.parse(userJson) as {
      name?: { firstName?: string; lastName?: string };
    };
    const first = parsed.name?.firstName?.trim() ?? '';
    const last = parsed.name?.lastName?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full || null;
  } catch {
    return null;
  }
}

export async function exchangeAppleOAuthCode(
  c: Context<{ Bindings: Env }>,
  code: string,
  stateFromBody: string | null | undefined,
  userJson?: string | null,
): Promise<AppleSignInResult> {
  const stateRaw = getCookie(c, APPLE_OAUTH_STATE_COOKIE);
  if (!stateRaw) {
    throw new Error('OAuth session expired. Please try signing in again.');
  }

  let parsed: { state?: string; redirectUri?: string };
  try {
    parsed = JSON.parse(stateRaw) as { state?: string; redirectUri?: string };
  } catch {
    throw new Error('Invalid OAuth state');
  }

  if (!parsed.state || !parsed.redirectUri || parsed.state !== stateFromBody) {
    throw new Error('OAuth state mismatch. Please try signing in again.');
  }

  const clientId = c.env.APPLE_SERVICES_ID!.trim();
  const clientSecret = createAppleClientSecret(c.env);

  const tokenRes = await fetch(APPLE_TOKEN_URL, {
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

  const tokenJson = (await tokenRes.json()) as AppleTokenResponse;
  if (!tokenRes.ok || !tokenJson.id_token) {
    console.error('Apple token exchange failed', tokenRes.status, tokenJson);
    throw new Error(
      tokenJson.error_description ||
        tokenJson.error ||
        'Apple sign-in could not be completed',
    );
  }

  const idClaims = await verifyAppleJwt(tokenJson.id_token, clientId);
  const sub = typeof idClaims.sub === 'string' ? idClaims.sub : '';
  const email = typeof idClaims.email === 'string' ? idClaims.email : '';
  if (!sub || !email) {
    throw new Error('Apple did not return a usable email for this account');
  }

  const info: AppleUserInfo = {
    sub,
    email,
    email_verified: idClaims.email_verified === true || idClaims.email_verified === 'true',
    is_private_email:
      idClaims.is_private_email === true ||
      idClaims.is_private_email === 'true' ||
      String(idClaims.is_private_email) === 'true',
    name: parseAppleUserName(userJson),
  };

  return resolveAppleSignInSession(c.env.DB, info);
}

export async function validateAppleSession(
  db: D1Database,
  rawToken: string,
): Promise<MochaUser | null> {
  const tokenHash = hashOpaqueToken(rawToken);
  const session = await db
    .prepare(
      `SELECT apple_sessions.user_id, apple_sessions.expires_at
       FROM apple_sessions
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string }>();

  if (!session) {
    return null;
  }
  if (new Date(session.expires_at) <= new Date()) {
    await db
      .prepare('DELETE FROM apple_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();
    return null;
  }

  const account = await db
    .prepare('SELECT id, email, display_name FROM apple_accounts WHERE id = ?')
    .bind(session.user_id)
    .first<{ id: string; email: string; display_name: string | null }>();

  if (!account) {
    return null;
  }
  return appleAccountToMochaUser(account);
}

export async function revokeAppleSession(db: D1Database, rawToken: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);
  await db
    .prepare('DELETE FROM apple_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function revokeAllAppleSessionsForUser(
  db: D1Database,
  userId: string,
): Promise<void> {
  await db.prepare('DELETE FROM apple_sessions WHERE user_id = ?').bind(userId).run();
}

export function setAppleSessionCookie(c: Context, rawToken: string): void {
  const local = isLocalDevHost(c);
  setCookie(c, APPLE_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    path: '/',
    sameSite: local ? 'lax' : 'none',
    secure: !local,
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearAppleSessionCookie(c: Context): void {
  const local = isLocalDevHost(c);
  setCookie(c, APPLE_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: local ? 'lax' : 'none',
    secure: !local,
    maxAge: 0,
  });
}

export function postAuthRedirectUrl(c: Context<{ Bindings: Env }>): string {
  const publicApp =
    typeof c.env.PUBLIC_APP_URL === 'string' ? c.env.PUBLIC_APP_URL.trim() : '';
  if (publicApp) {
    return publicApp.replace(/\/$/, '');
  }
  const origin = c.req.header('origin')?.trim();
  if (origin) {
    return origin.replace(/\/$/, '');
  }
  try {
    return new URL(c.req.url).origin;
  } catch {
    return '/';
  }
}
