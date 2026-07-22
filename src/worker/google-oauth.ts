import type { Context } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import * as nodeCrypto from 'node:crypto';
import type { MochaUser } from '@/shared/mocha-user';
import {
  normalizeOAuthCallbackUrl,
  nativeIosGoogleOAuthCallbackUrl,
} from '../shared/oauth-redirect';
import {
  createOAuthStateToken,
  consumeOAuthPendingState,
  saveOAuthPendingState,
} from './oauth-state-store';
import { normalizeEmail } from './auth-password-utils';
import {
  findEmailAccountByGoogleEmail,
  findEmailAccountByGoogleSub,
  findExistingAccountByEmail,
  linkGoogleSubOnEmailAccount,
  reassignMochaUserId,
  upsertUserEmailIndex,
} from './account-linking';
import {
  ensureAppleBridgeAccount,
  ensureGoogleBridgeAccount,
} from './mocha-identity-sync';
import { ensureOAuthUserProfile } from './oauth-profile-bootstrap';
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function hashOpaqueToken(raw: string): string {
  return nodeCrypto.createHash('sha256').update(raw, 'utf8').digest('hex');
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

function readRedirectFromQuery(c: Context<{ Bindings: Env }>): string | undefined {
  const raw =
    c.req.query('redirect_uri')?.trim() || c.req.query('redirect_base')?.trim();
  return raw || undefined;
}

function resolveOAuthAppOrigin(
  c: Context<{ Bindings: Env }>,
  redirectBaseQuery?: string,
): string {
  const fromQuery = redirectBaseQuery?.trim() || readRedirectFromQuery(c);
  if (fromQuery) {
    try {
      if (fromQuery.includes('://')) {
        return new URL(fromQuery).origin;
      }
      return fromQuery.replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }

  const explicit =
    typeof c.env.OAUTH_REDIRECT_URI === 'string'
      ? c.env.OAUTH_REDIRECT_URI.trim()
      : '';
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* fall through */
    }
  }

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
    return '';
  }
}

/**
 * Resolve the exact redirect_uri sent to Google. Prefer the browser's current origin
 * (redirect_uri query) so it matches where the user is actually signed in.
 */
export function resolveOAuthCallbackUrl(
  c: Context<{ Bindings: Env }>,
  redirectBaseQuery?: string,
): string {
  const nativeApp =
    c.req.query('native_app') === '1' || c.req.query('native_app') === 'true';
  if (nativeApp) {
    return nativeIosGoogleOAuthCallbackUrl(
      resolveOAuthAppOrigin(c, redirectBaseQuery),
    );
  }

  const fromQuery = redirectBaseQuery?.trim() || readRedirectFromQuery(c);
  if (fromQuery) {
    return normalizeOAuthCallbackUrl(fromQuery);
  }

  const explicit =
    typeof c.env.OAUTH_REDIRECT_URI === 'string'
      ? c.env.OAUTH_REDIRECT_URI.trim()
      : '';
  if (explicit) {
    return normalizeOAuthCallbackUrl(explicit);
  }

  const publicApp =
    typeof c.env.PUBLIC_APP_URL === 'string' ? c.env.PUBLIC_APP_URL.trim() : '';
  if (publicApp) {
    return normalizeOAuthCallbackUrl(publicApp);
  }

  const origin = c.req.header('origin')?.trim();
  if (origin) {
    return normalizeOAuthCallbackUrl(origin);
  }

  const referer = c.req.header('referer')?.trim();
  if (referer) {
    try {
      return normalizeOAuthCallbackUrl(new URL(referer).origin);
    } catch {
      /* ignore */
    }
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

export async function buildGoogleOAuthRedirectUrl(
  c: Context<{ Bindings: Env }>,
  redirectUri: string,
): Promise<string> {
  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID!.trim();
  const state = createOAuthStateToken();
  setCookie(
    c,
    GOOGLE_OAUTH_STATE_COOKIE,
    JSON.stringify({ state, redirectUri }),
    oauthStateCookieOptions(c),
  );
  await saveOAuthPendingState(c.env.DB, state, 'google', redirectUri);

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
      picture: null,
      sub: row.id,
    },
    last_signed_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export type GoogleSignInResult = {
  sessionToken: string;
  /** Use `momentum_email_session` when linked to an existing email/password account. */
  sessionType: 'google' | 'email' | 'apple';
};

async function removeOtherGoogleAccountsForEmail(
  db: D1Database,
  email: string,
  keepSub: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM google_accounts WHERE lower(trim(email)) = ? AND id != ?')
    .bind(normalizeEmail(email), keepSub.trim())
    .run();
}

async function upsertGoogleAccount(
  db: D1Database,
  info: GoogleUserInfo,
): Promise<{ id: string; email: string; display_name: string | null }> {
  const sub = info.sub?.trim();
  const email = normalizeEmail(info.email ?? '');
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
  await upsertUserEmailIndex(db, email, row.id, 'google');
  return row;
}

export async function createGoogleSession(
  db: D1Database,
  userId: string,
): Promise<string> {
  const rawToken = nodeCrypto.randomBytes(32).toString('hex');
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

async function createEmailSessionToken(
  db: D1Database,
  userId: string,
): Promise<string> {
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

/**
 * Resolve a Google sign-in to a single canonical account (email, Google, Apple, or indexed).
 */
async function resolveGoogleSignInSession(
  db: D1Database,
  info: GoogleUserInfo,
): Promise<GoogleSignInResult> {
  const sub = info.sub?.trim();
  const email = info.email?.trim();
  if (!sub || !email) {
    throw new Error('Google account is missing required profile fields');
  }

  const normalizedEmail = normalizeEmail(email);
  let mochaUserId: string;
  let sessionToken: string;
  let sessionType: GoogleSignInResult['sessionType'];

  const linkedEmailAccount = await findEmailAccountByGoogleSub(db, sub);
  if (linkedEmailAccount) {
    await upsertGoogleAccount(db, info);
    await upsertUserEmailIndex(db, normalizedEmail, linkedEmailAccount.id, 'email');
    mochaUserId = linkedEmailAccount.id;
    sessionToken = await createEmailSessionToken(db, linkedEmailAccount.id);
    sessionType = 'email';
  } else {
    const emailAccount = await findEmailAccountByGoogleEmail(db, email);
    if (emailAccount) {
      await linkGoogleSubOnEmailAccount(db, emailAccount.id, sub);
      await reassignMochaUserId(db, sub, emailAccount.id);
      await removeOtherGoogleAccountsForEmail(db, normalizedEmail, sub);
      await upsertGoogleAccount(db, info);
      await upsertUserEmailIndex(db, normalizedEmail, emailAccount.id, 'email');
      mochaUserId = emailAccount.id;
      sessionToken = await createEmailSessionToken(db, emailAccount.id);
      sessionType = 'email';
    } else {
      const existing = await findExistingAccountByEmail(db, email);

      if (existing) {
        const canonicalId = existing.account.id;
        if (canonicalId !== sub) {
          await reassignMochaUserId(db, sub, canonicalId);
          await removeOtherGoogleAccountsForEmail(db, normalizedEmail, sub);
        }

        if (existing.type === 'google' && canonicalId === sub) {
          await upsertGoogleAccount(db, info);
        } else {
          try {
            await upsertGoogleAccount(db, info);
          } catch (e) {
            console.warn('resolveGoogleSignInSession: google_accounts upsert skipped', e);
          }
        }

        const indexSource =
          existing.type === 'indexed'
            ? 'mocha'
            : existing.type === 'email'
              ? 'email'
              : existing.type === 'apple'
                ? 'apple'
                : 'google';
        await upsertUserEmailIndex(db, normalizedEmail, canonicalId, indexSource);

        mochaUserId = canonicalId;

        if (existing.type === 'email') {
          await linkGoogleSubOnEmailAccount(db, canonicalId, sub);
          sessionToken = await createEmailSessionToken(db, canonicalId);
          sessionType = 'email';
        } else if (existing.type === 'apple') {
          await ensureAppleBridgeAccount(
            db,
            canonicalId,
            normalizedEmail,
            info.name,
          );
          const { createAppleOAuthSession } = await import('./apple-oauth');
          sessionToken = await createAppleOAuthSession(db, canonicalId);
          sessionType = 'apple';
        } else if (existing.type === 'indexed') {
          await ensureGoogleBridgeAccount(
            db,
            canonicalId,
            normalizedEmail,
            info.name,
          );
          sessionToken = await createGoogleSession(db, canonicalId);
          sessionType = 'google';
        } else {
          sessionToken = await createGoogleSession(db, canonicalId);
          sessionType = 'google';
        }
      } else {
        await upsertGoogleAccount(db, info);
        mochaUserId = sub;
        sessionToken = await createGoogleSession(db, sub);
        sessionType = 'google';
      }
    }
  }

  await ensureOAuthUserProfile(db, mochaUserId, {
    email: normalizedEmail,
    avatarUrl: info.picture,
  });

  return { sessionToken, sessionType };
}

async function resolveGoogleOAuthState(
  c: Context<{ Bindings: Env }>,
  stateFromQuery?: string | null,
  redirectUriFromBody?: string | null,
): Promise<{ state: string; redirectUri: string }> {
  const stateRaw = getCookie(c, GOOGLE_OAUTH_STATE_COOKIE);
  if (stateRaw) {
    let parsed: { state?: string; redirectUri?: string };
    try {
      parsed = JSON.parse(stateRaw) as { state?: string; redirectUri?: string };
    } catch {
      throw new Error('Invalid OAuth state');
    }
    if (!parsed.state || !parsed.redirectUri || parsed.state !== stateFromQuery) {
      throw new Error('OAuth state mismatch. Please try signing in again.');
    }
    return { state: parsed.state, redirectUri: parsed.redirectUri };
  }

  const state = stateFromQuery?.trim();
  if (!state) {
    throw new Error('OAuth session expired. Please try signing in again.');
  }

  const pending = await consumeOAuthPendingState(c.env.DB, state, 'google');
  if (!pending) {
    throw new Error('OAuth session expired. Please try signing in again.');
  }

  if (
    redirectUriFromBody &&
    redirectUriFromBody.trim() &&
    redirectUriFromBody.trim() !== pending.redirectUri
  ) {
    throw new Error('OAuth redirect URI mismatch. Please try signing in again.');
  }

  return { state: pending.state, redirectUri: pending.redirectUri };
}

export async function exchangeGoogleOAuthCode(
  c: Context<{ Bindings: Env }>,
  code: string,
  stateFromQuery?: string | null,
  redirectUriFromBody?: string | null,
): Promise<GoogleSignInResult> {
  const { redirectUri } = await resolveGoogleOAuthState(
    c,
    stateFromQuery,
    redirectUriFromBody,
  );

  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID!.trim();
  const clientSecret = c.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim();

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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

  return resolveGoogleSignInSession(c.env.DB, userInfo);
}

type GoogleIdTokenInfo = {
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  aud?: string;
  error?: string;
  error_description?: string;
};

/** Verify a Google ID token from native iOS Sign-In and create a session. */
export async function exchangeGoogleNativeIdToken(
  env: Env,
  idToken: string,
): Promise<GoogleSignInResult> {
  const token = idToken.trim();
  if (!token) {
    throw new Error('Google identity token is required');
  }

  const webClientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const iosClientId = env.GOOGLE_IOS_OAUTH_CLIENT_ID?.trim();
  const iosClientIdRn = env.GOOGLE_IOS_OAUTH_CLIENT_ID_RN?.trim();
  if (!webClientId) {
    throw new Error('Google sign-in is not configured on the server.');
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
  );
  const info = (await res.json()) as GoogleIdTokenInfo;
  if (!res.ok) {
    throw new Error(
      info.error_description ||
        info.error ||
        'Google sign-in could not be verified. Please try again.',
    );
  }

  const allowedAudiences = new Set(
    [webClientId, iosClientId, iosClientIdRn].filter((id): id is string => Boolean(id)),
  );
  if (!info.aud || !allowedAudiences.has(info.aud)) {
    throw new Error('Google identity token audience mismatch.');
  }

  const userInfo: GoogleUserInfo = {
    sub: info.sub,
    email: info.email,
    email_verified: info.email_verified === 'true',
    name: info.name,
    picture: info.picture,
  };

  if (!userInfo.sub) {
    throw new Error('Google account is missing required profile fields');
  }

  return resolveGoogleSignInSession(env.DB, userInfo);
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
