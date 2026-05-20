type SendPasswordResetEmailOpts = {
  apiKey: string;
  from: string;
  to: string;
  resetUrl: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send password reset email via Resend (no-reply sender configured in `from`).
 */
export async function sendPasswordResetEmail(opts: SendPasswordResetEmailOpts): Promise<void> {
  const { apiKey, from, to, resetUrl } = opts;
  const safeUrl = escapeHtml(resetUrl);

  const text = [
    'You requested a password reset for your FEEDBACK account.',
    '',
    `Choose a new password: ${resetUrl}`,
    '',
    'This link expires in one hour. If you did not request a reset, you can ignore this email.',
    '',
    'After updating your password, sign in again at the app.',
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your FEEDBACK password',
      text,
      html: `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p>You requested a password reset for your <strong>FEEDBACK</strong> account.</p>
  <p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#14b8a6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Choose a new password</a></p>
  <p style="font-size:14px;color:#555">Or copy this link:<br><a href="${safeUrl}">${safeUrl}</a></p>
  <p style="font-size:14px;color:#555">This link expires in one hour. If you did not request a reset, you can ignore this email.</p>
</body>
</html>`,
    }),
  });

  if (!res.ok) {
    const textBody = await res.text();
    console.error('Resend password reset email failed', res.status, textBody);
    const err = new Error('email_provider_error') as Error & { providerDetail?: string };
    try {
      const parsed = JSON.parse(textBody) as { message?: string };
      if (parsed.message) err.providerDetail = parsed.message;
    } catch {
      if (textBody.length < 500) err.providerDetail = textBody;
    }
    throw err;
  }
}

/** Log reset URL to the Worker console (local dev when Resend is not configured). */
export function logPasswordResetLinkDev(resetUrl: string): void {
  console.info('[password reset] RESEND_API_KEY unset; reset link (dev only):', resetUrl);
}
