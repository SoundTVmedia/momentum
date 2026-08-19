/** Published support inbox (Apple App Review Guidelines § 1.2 requires reachable contact). */
export const SUPPORT_INBOX_EMAIL = 'support@soundtvmedia.com';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendViaResend(
  apiKey: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend ${label} failed`, res.status, body);
    throw new Error('email_provider_error');
  }
}

export type SupportFormEmailOpts = {
  apiKey: string;
  from: string;
  to: string;
  name: string;
  email: string;
  topicLabel: string;
  message: string;
  diagnostics?: string | null;
};

export async function sendSupportFormEmail(opts: SupportFormEmailOpts): Promise<void> {
  const { apiKey, from, to, name, email, topicLabel, message, diagnostics } = opts;

  const lines = [
    `From: ${name} <${email}>`,
    `Topic: ${topicLabel}`,
    '',
    message,
  ];
  if (diagnostics) {
    lines.push('', '--- diagnostics ---', diagnostics);
  }
  const text = lines.join('\n');

  await sendViaResend(
    apiKey,
    {
      from,
      to: [to],
      reply_to: email,
      subject: `[Support: ${topicLabel}] ${name}`,
      text,
      html: `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
  <p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>
  <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
  ${diagnostics ? `<hr><pre style="white-space:pre-wrap;font-size:12px;color:#555">${escapeHtml(diagnostics)}</pre>` : ''}
</body>
</html>`,
    },
    'support form email',
  );
}

export type UrgentReportEmailOpts = {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  lines: string[];
};

/**
 * Founder alert for reports that jump the queue (minors, crisis, threats, doxxing).
 * Delivery must never block the reporter's response — callers swallow failures.
 */
export async function sendUrgentReportEmail(opts: UrgentReportEmailOpts): Promise<void> {
  const { apiKey, from, to, subject, lines } = opts;
  const text = lines.join('\n');

  await sendViaResend(
    apiKey,
    {
      from,
      to: [to],
      subject,
      text,
      html: `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre>
</body>
</html>`,
    },
    'urgent report email',
  );
}
