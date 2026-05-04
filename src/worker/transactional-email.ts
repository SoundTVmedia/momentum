type SendPasswordResetEmailOpts = {
  apiKey: string | undefined;
  from: string;
  to: string;
  resetUrl: string;
  /** When true and API key is missing, log the full link (local dev only). */
  logResetLinkForDev: boolean;
};

export async function sendPasswordResetEmail(opts: SendPasswordResetEmailOpts): Promise<void> {
  const { apiKey, from, to, resetUrl, logResetLinkForDev } = opts;
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) {
    if (logResetLinkForDev) {
      console.info('[password reset] RESEND_API_KEY unset; reset link (dev only):', resetUrl);
    } else {
      console.warn('password reset: RESEND_API_KEY not set; email not sent');
    }
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your Momentum password',
      html: `<p>You requested a password reset for your Momentum account.</p>
<p><a href="${resetUrl}">Choose a new password</a></p>
<p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Resend password reset email failed', res.status, text);
    throw new Error('email_provider_error');
  }
}
