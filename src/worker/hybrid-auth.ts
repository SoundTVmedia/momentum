import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import * as crypto from 'crypto';
import {
  getCurrentUser,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
  DEFAULT_MOCHA_USERS_SERVICE_API_URL,
} from '@getmocha/users-service/backend';
import type { MochaUser } from '@getmocha/users-service/shared';

export const EMAIL_SESSION_COOKIE_NAME = 'momentum_email_session';

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function isRfc1918PrivateHost(host: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
}

/**
 * Browsers ignore Secure cookies on http:// — breaks local email/OAuth sessions.
 * Includes RFC1918 hosts over plain HTTP (e.g. Docker-published Vite on 172.x).
 */
export function isLocalDevHost(c: Context): boolean {
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
  return isRfc1918PrivateHost(host);
}

function sessionCookieOptions(c: Context) {
  const local = isLocalDevHost(c);
  return {
    httpOnly: true,
    path: '/',
    sameSite: (local ? 'lax' : 'none') as 'lax' | 'none',
    secure: !local,
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

export function hashOpaqueToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function hashSessionToken(raw: string): string {
  return hashOpaqueToken(raw);
}

export function emailAccountToMochaUser(row: {
  id: string;
  email: string;
  display_name: string | null;
}): MochaUser {
  const name = row.display_name?.trim() || row.email.split('@')[0] || 'User';
  const sub = `email:${row.id}`;
  return {
    id: row.id,
    email: row.email,
    google_sub: sub,
    google_user_data: {
      email: row.email,
      email_verified: false,
      name,
      sub,
    },
    last_signed_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function createEmailSession(
  db: D1Database,
  userId: string
): Promise<{ rawToken: string }> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_MAX_AGE_SEC);

  await db
    .prepare(
      `INSERT INTO email_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
    )
    .bind(userId, tokenHash, expiresAt.toISOString())
    .run();

  return { rawToken };
}

export async function validateEmailSession(
  db: D1Database,
  rawToken: string
): Promise<{ id: string; email: string; display_name: string | null } | null> {
  const tokenHash = hashSessionToken(rawToken);
  const session = await db
    .prepare(
      `SELECT email_sessions.user_id, email_sessions.expires_at
       FROM email_sessions
       WHERE token_hash = ?`
    )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string }>();

  if (!session) {
    return null;
  }
  if (new Date(session.expires_at) <= new Date()) {
    await db
      .prepare('DELETE FROM email_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();
    return null;
  }

  const account = await db
    .prepare(
      'SELECT id, email, display_name FROM email_accounts WHERE id = ?'
    )
    .bind(session.user_id)
    .first<{ id: string; email: string; display_name: string | null }>();

  return account;
}

export async function revokeEmailSession(db: D1Database, rawToken: string) {
  const tokenHash = hashSessionToken(rawToken);
  await db
    .prepare('DELETE FROM email_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function revokeAllEmailSessionsForUser(db: D1Database, userId: string) {
  await db.prepare('DELETE FROM email_sessions WHERE user_id = ?').bind(userId).run();
}

export function setEmailSessionCookie(c: Context, rawToken: string) {
  setCookie(c, EMAIL_SESSION_COOKIE_NAME, rawToken, sessionCookieOptions(c));
}

export function clearEmailSessionCookie(c: Context) {
  const local = isLocalDevHost(c);
  setCookie(c, EMAIL_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: local ? 'lax' : 'none',
    secure: !local,
    maxAge: 0,
  });
}

/**
 * Try Mocha session cookie, then email session cookie. Sets `user` on context.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const mochaToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
  if (typeof mochaToken === 'string' && mochaToken.length > 0) {
    const user = await getCurrentUser(mochaToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL || DEFAULT_MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
    if (user) {
      c.set('user', user);
      await next();
      return;
    }
  }

  const emailToken = getCookie(c, EMAIL_SESSION_COOKIE_NAME);
  if (typeof emailToken === 'string' && emailToken.length > 0) {
    const account = await validateEmailSession(c.env.DB, emailToken);
    if (account) {
      c.set('user', emailAccountToMochaUser(account));
      await next();
      return;
    }
  }

  return c.json({ error: 'Unauthorized' }, 401);
});

export { SESSION_MAX_AGE_SEC };
