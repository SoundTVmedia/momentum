import { Context } from 'hono';
import * as crypto from 'crypto';
import {
  createEmailSession,
  setEmailSessionCookie,
  hashOpaqueToken,
  revokeAllEmailSessionsForUser,
  isLocalDevHost,
} from './hybrid-auth';
import {
  hashPassword,
  verifyPasswordStored,
  normalizeEmail,
  isValidEmail,
} from './auth-password-utils';
import { sendPasswordResetEmail } from './transactional-email';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function passwordResetAppBaseUrl(c: Context<{ Bindings: Env }>, bodyRedirectBase?: string): string {
  const trimmed = bodyRedirectBase?.trim();
  if (trimmed) {
    return trimmed.replace(/\/$/, '');
  }
  const origin = c.req.header('origin')?.trim();
  if (origin) {
    return origin.replace(/\/$/, '');
  }
  const envUrl =
    typeof c.env.PUBLIC_APP_URL === 'string' ? c.env.PUBLIC_APP_URL.trim() : '';
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  try {
    return new URL(c.req.url).origin;
  } catch {
    return '';
  }
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

const FORGOT_PASSWORD_OK_MESSAGE =
  'If an account exists for this email, we sent password reset instructions.';

/**
 * Request a password reset link (email/password accounts only). Always returns the same message when the email is valid.
 */
export async function requestPasswordReset(c: Context<{ Bindings: Env }>) {
  let body: { email?: string; redirect_base?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const emailRaw = body.email;
  if (!emailRaw || typeof emailRaw !== 'string') {
    return c.json({ error: 'Email is required' }, 400);
  }

  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return c.json({ error: 'Please enter a valid email address' }, 400);
  }

  const row = await c.env.DB.prepare('SELECT id, email FROM email_accounts WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string }>();

  if (!row) {
    return c.json({ success: true, message: FORGOT_PASSWORD_OK_MESSAGE }, 200);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  try {
    await c.env.DB.prepare('DELETE FROM email_password_resets WHERE user_id = ?')
      .bind(row.id)
      .run();
    await c.env.DB.prepare(
      `INSERT INTO email_password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
    )
      .bind(row.id, tokenHash, expiresAt.toISOString())
      .run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('no such table')) {
      console.error('requestPasswordReset: apply D1 migrations (email_password_resets)', e);
      return c.json(
        {
          error:
            'Database is missing password reset tables. Apply migrations (e.g. npx wrangler d1 migrations apply momentum-db --local).',
        },
        500
      );
    }
    console.error('requestPasswordReset:', e);
    return c.json({ error: 'Could not process request. Try again later.' }, 500);
  }

  const base = passwordResetAppBaseUrl(c, body.redirect_base);
  if (!base) {
    console.error('requestPasswordReset: could not determine app URL (Origin, redirect_base, or PUBLIC_APP_URL)');
    return c.json(
      { error: 'Server could not build reset link. Set PUBLIC_APP_URL or send redirect_base.' },
      500
    );
  }

  const resetUrl = `${base}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  const from =
    typeof c.env.TRANSACTIONAL_EMAIL_FROM === 'string' && c.env.TRANSACTIONAL_EMAIL_FROM.trim()
      ? c.env.TRANSACTIONAL_EMAIL_FROM.trim()
      : 'Momentum <onboarding@resend.dev>';

  try {
    const hasResendKey =
      typeof c.env.RESEND_API_KEY === 'string' && c.env.RESEND_API_KEY.trim() !== '';
    await sendPasswordResetEmail({
      apiKey: c.env.RESEND_API_KEY,
      from,
      to: row.email,
      resetUrl,
      logResetLinkForDev: isLocalDevHost(c) && !hasResendKey,
    });
  } catch {
    return c.json({ error: 'Could not send reset email. Try again later.' }, 500);
  }

  return c.json({ success: true, message: FORGOT_PASSWORD_OK_MESSAGE }, 200);
}

/**
 * Complete password reset using the token from the email link.
 */
export async function confirmPasswordReset(c: Context<{ Bindings: Env }>) {
  let body: { token?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const tokenRaw = body.token;
  const password = body.password;
  if (!tokenRaw || typeof tokenRaw !== 'string' || !password) {
    return c.json({ error: 'Token and new password are required' }, 400);
  }

  if (password.length < 8) {
    return c.json(
      { error: 'Password must be at least 8 characters long' },
      400
    );
  }

  const tokenHash = hashOpaqueToken(tokenRaw.trim());

  let userId: string;
  try {
    const resetRow = await c.env.DB.prepare(
      `SELECT user_id, expires_at FROM email_password_resets WHERE token_hash = ?`
    )
      .bind(tokenHash)
      .first<{ user_id: string; expires_at: string }>();

    if (!resetRow || new Date(resetRow.expires_at) <= new Date()) {
      if (resetRow) {
        await c.env.DB.prepare('DELETE FROM email_password_resets WHERE token_hash = ?')
          .bind(tokenHash)
          .run();
      }
      return c.json(
        { error: 'This reset link is invalid or has expired. Request a new one.' },
        400
      );
    }
    userId = resetRow.user_id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('no such table')) {
      return c.json(
        {
          error:
            'Database is missing password reset tables. Apply migrations (e.g. npx wrangler d1 migrations apply momentum-db --local).',
        },
        500
      );
    }
    console.error('confirmPasswordReset lookup:', e);
    return c.json({ error: 'Could not verify reset token.' }, 500);
  }

  const newHash = hashPassword(password);

  try {
    await c.env.DB.prepare(
      'UPDATE email_accounts SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(newHash, userId)
      .run();
    await c.env.DB.prepare('DELETE FROM email_password_resets WHERE user_id = ?')
      .bind(userId)
      .run();
    await revokeAllEmailSessionsForUser(c.env.DB, userId);
  } catch (e) {
    console.error('confirmPasswordReset:', e);
    return c.json({ error: 'Could not update password. Try again.' }, 500);
  }

  return c.json({ success: true }, 200);
}
