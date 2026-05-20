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

export function resolveResendApiKey(env: { RESEND_API_KEY?: string }): string {
  return typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
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
  'Password reset email is not configured on the server. Add RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM (verified no-reply sender, e.g. FEEDBACK <no-reply@yourdomain.com>) to .dev.vars for local dev or wrangler secrets for production.';
