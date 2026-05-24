import type { Context } from 'hono';
import { shouldLogPasswordResetLinkInsteadOfEmail } from './hybrid-auth';

/** Resend test sender — works with any API key; deliver only to your Resend account email in sandbox. */
export const RESEND_SANDBOX_FROM = 'FEEDBACK <onboarding@resend.dev>';

export type PasswordResetEmailDelivery =
  | { mode: 'send'; apiKey: string; from: string }
  | { mode: 'dev_log'; resetUrl: string }
  | { mode: 'unconfigured' };

export function resolveTransactionalEmailFrom(env: {
  TRANSACTIONAL_EMAIL_FROM?: string;
}): string {
  const raw =
    typeof env.TRANSACTIONAL_EMAIL_FROM === 'string' ? env.TRANSACTIONAL_EMAIL_FROM.trim() : '';
  return raw || RESEND_SANDBOX_FROM;
}

/** Reject empty, malformed, or doc-placeholder Resend keys so local dev can fall back to console logging. */
export function isUsableResendApiKey(apiKey: string): boolean {
  const key = apiKey.trim();
  if (!key) return false;
  if (!/^re_[A-Za-z0-9_]+$/.test(key)) return false;
  if (key.length < 16) return false;
  if (/^re_x+$/i.test(key)) return false;
  const lower = key.toLowerCase();
  if (
    lower.includes('your') ||
    lower.includes('placeholder') ||
    lower.includes('changeme') ||
    lower.includes('example')
  ) {
    return false;
  }
  return true;
}

export function resolveResendApiKey(env: { RESEND_API_KEY?: string }): string {
  const raw =
    typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  if (!raw) return '';
  if (!isUsableResendApiKey(raw)) {
    console.warn(
      'RESEND_API_KEY is set but invalid or looks like a placeholder — password reset will not call Resend until a real key is configured',
    );
    return '';
  }
  return raw;
}

/**
 * Decide whether to send via Resend, log the link locally, or report missing configuration.
 */
export function resolvePasswordResetEmailDelivery(
  c: Context<{ Bindings: Env }>,
  opts: { redirectBase?: string; resetUrl: string },
): PasswordResetEmailDelivery {
  const apiKey = resolveResendApiKey(c.env);
  const from = resolveTransactionalEmailFrom(c.env);
  const hasResendKey = apiKey.length > 0;

  if (hasResendKey) {
    return { mode: 'send', apiKey, from };
  }

  if (
    shouldLogPasswordResetLinkInsteadOfEmail(c, {
      hasResendKey: false,
      redirectBase: opts.redirectBase,
    })
  ) {
    return { mode: 'dev_log', resetUrl: opts.resetUrl };
  }

  return { mode: 'unconfigured' };
}

export const PASSWORD_RESET_EMAIL_NOT_CONFIGURED =
  'Password reset email is not configured. Add a valid RESEND_API_KEY to .dev.vars (local) or run `npx wrangler secret put RESEND_API_KEY` (production — no = in the command). TRANSACTIONAL_EMAIL_FROM is optional; sandbox defaults to onboarding@resend.dev.';
