import { Context } from 'hono';
import * as crypto from 'crypto';
import {
  createEmailSession,
  setEmailSessionCookie,
} from './hybrid-auth';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

function verifyPasswordStored(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, hash] = parts;
  const verify = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(verify, 'hex')
    );
  } catch {
    return false;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Register with email and password. Creates a local account and session cookie.
 */
export async function emailSignUp(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json();
  const emailRaw = body.email as string | undefined;
  const password = body.password as string | undefined;
  const displayName = (body.display_name as string | undefined)?.trim() || '';

  if (!emailRaw || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return c.json({ error: 'Please enter a valid email address' }, 400);
  }

  if (password.length < 8) {
    return c.json(
      { error: 'Password must be at least 8 characters long' },
      400
    );
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  try {
    await c.env.DB.prepare(
      `INSERT INTO email_accounts (id, email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(id, email, passwordHash, displayName || null)
      .run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return c.json(
        { error: 'An account with this email already exists. Try signing in.' },
        409
      );
    }
    if (msg.includes('no such table')) {
      console.error('emailSignUp: missing tables — apply D1 migrations', e);
      return c.json(
        {
          error:
            'Database is missing email auth tables. Apply migrations (e.g. npx wrangler d1 migrations apply momentum-db --local).',
        },
        500
      );
    }
    console.error('emailSignUp insert error:', e);
    return c.json({ error: 'Could not create account. Please try again.' }, 500);
  }

  let rawToken: string;
  try {
    const session = await createEmailSession(c.env.DB, id);
    rawToken = session.rawToken;
  } catch (sessionErr) {
    console.error('emailSignUp session error:', sessionErr);
    await c.env.DB.prepare('DELETE FROM email_accounts WHERE id = ?').bind(id).run();
    const smsg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
    if (smsg.includes('no such table')) {
      return c.json(
        {
          error:
            'Database is missing email auth tables. Apply D1 migrations (e.g. npx wrangler d1 migrations apply momentum-db --local).',
        },
        500
      );
    }
    return c.json({ error: 'Could not create session. Please try again.' }, 500);
  }

  setEmailSessionCookie(c, rawToken);

  return c.json({ success: true, userId: id }, 201);
}

/**
 * Sign in with email and password. Sets email session cookie.
 */
export async function emailPasswordSignIn(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json();
  const emailRaw = body.email as string | undefined;
  const password = body.password as string | undefined;

  if (!emailRaw || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return c.json({ error: 'Please enter a valid email address' }, 400);
  }

  const row = await c.env.DB.prepare(
    'SELECT id, password_hash FROM email_accounts WHERE email = ?'
  )
    .bind(email)
    .first<{ id: string; password_hash: string }>();

  if (!row || !verifyPasswordStored(password, row.password_hash)) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const { rawToken } = await createEmailSession(c.env.DB, row.id);
  setEmailSessionCookie(c, rawToken);

  return c.json({ success: true }, 200);
}
