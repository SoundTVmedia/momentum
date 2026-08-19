import type { Context } from 'hono';
import { isLocalDevHost } from './hybrid-auth';
import { resolveResendApiKey, resolveTransactionalEmailFrom } from './transactional-email-config';
import { SUPPORT_INBOX_EMAIL, sendSupportFormEmail } from './support-email';

const TOPIC_LABELS: Record<string, string> = {
  general: 'General support',
  bug: 'Bug report',
  report: 'Safety or content report',
  privacy: 'Privacy or data request',
  billing: 'Subscription or billing',
};

const MAX_NAME = 120;
const MAX_MESSAGE = 5000;
const MAX_DIAGNOSTICS = 500;

function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Unauthenticated contact form. Apple requires published contact that is not behind a login,
 * so this route stays open and is rate limited instead.
 */
export async function submitSupportRequest(c: Context<{ Bindings: Env }>) {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : 'general';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const diagnostics =
    typeof body.diagnostics === 'string' ? body.diagnostics.trim().slice(0, MAX_DIAGNOSTICS) : '';

  if (!name || name.length > MAX_NAME) {
    return c.json({ error: 'Tell us your name so we know who we are replying to' }, 400);
  }
  if (!isEmailish(email) || email.length > 254) {
    return c.json({ error: 'Enter an email address we can reply to' }, 400);
  }
  if (!message) {
    return c.json({ error: 'Tell us what is going on' }, 400);
  }
  if (message.length > MAX_MESSAGE) {
    return c.json({ error: `Keep your message under ${MAX_MESSAGE} characters` }, 400);
  }

  const topicLabel = TOPIC_LABELS[topic] ?? TOPIC_LABELS.general;
  const apiKey = resolveResendApiKey(c.env);

  if (!apiKey) {
    if (isLocalDevHost(c)) {
      console.info(
        '[support form] RESEND_API_KEY unset; message (dev only):',
        JSON.stringify({ name, email, topicLabel, message, diagnostics }),
      );
      return c.json({ success: true });
    }
    console.error('submitSupportRequest: RESEND_API_KEY is not set — support email not delivered');
    return c.json(
      {
        error: `We could not send that just now. Please email ${SUPPORT_INBOX_EMAIL} directly.`,
      },
      503,
    );
  }

  try {
    await sendSupportFormEmail({
      apiKey,
      from: resolveTransactionalEmailFrom(c.env),
      to: SUPPORT_INBOX_EMAIL,
      name,
      email,
      topicLabel,
      message,
      diagnostics: diagnostics || null,
    });
  } catch (err) {
    console.error('submitSupportRequest send failed:', err);
    return c.json(
      {
        error: `We could not send that just now. Please email ${SUPPORT_INBOX_EMAIL} directly.`,
      },
      502,
    );
  }

  return c.json({ success: true });
}
