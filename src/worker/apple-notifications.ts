import type { Context } from 'hono';
import { verifyAppleJwt } from './apple-jwt';
import { revokeAllAppleSessionsForUser } from './apple-oauth';
import { purgeUserAccount } from './user-purge-utils';

type AppleNotificationPayload = {
  type?: string;
  sub?: string;
};

export async function handleAppleServerNotification(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  const bundleId = c.env.APPLE_BUNDLE_ID?.trim() || 'com.feedback.app';

  let body: { payload?: string };
  try {
    body = (await c.req.json()) as { payload?: string };
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const jwt = body.payload?.trim();
  if (!jwt) {
    return c.json({ error: 'Missing payload' }, 400);
  }

  let claims: AppleNotificationPayload;
  try {
    claims = (await verifyAppleJwt(jwt, bundleId)) as AppleNotificationPayload;
  } catch (err) {
    console.error('Apple notification JWT verification failed:', err);
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const eventType = claims.type?.trim();
  const sub = claims.sub?.trim();
  if (!eventType || !sub) {
    return c.json({ ok: true, ignored: true }, 200);
  }

  console.log('Apple server notification:', eventType, sub);

  try {
    if (eventType === 'account-delete' || eventType === 'consent-revoked') {
      await revokeAllAppleSessionsForUser(c.env.DB, sub);
      if (eventType === 'account-delete') {
        try {
          await purgeUserAccount(c.env.DB, sub, { deleteClips: false });
        } catch (err) {
          console.warn('Apple account-delete purge:', err);
        }
      }
      await c.env.DB.prepare('DELETE FROM apple_accounts WHERE id = ?').bind(sub).run();
    } else if (eventType === 'email-disabled' || eventType === 'email-enabled') {
      const isPrivate = eventType === 'email-disabled' ? 1 : 0;
      await c.env.DB
        .prepare(
          `UPDATE apple_accounts
           SET is_private_email = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(isPrivate, sub)
        .run();
    }
  } catch (err) {
    console.error('Apple notification handler error:', err);
    return c.json({ error: 'Handler failed' }, 500);
  }

  return c.json({ ok: true }, 200);
}
