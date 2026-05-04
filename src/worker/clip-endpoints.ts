import type { Context } from 'hono';
import { purgeClipFromDatabase } from './clip-delete-utils';
import { createRealtimeService } from './realtime-service';

export async function deleteOwnClip(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const clipId = Number.parseInt(c.req.param('id'), 10);
  if (Number.isNaN(clipId)) {
    return c.json({ error: 'Invalid clip id' }, 400);
  }

  const clip = await c.env.DB.prepare(
    'SELECT id, mocha_user_id FROM clips WHERE id = ?'
  )
    .bind(clipId)
    .first<{ id: number; mocha_user_id: string }>();

  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  if (clip.mocha_user_id !== user.id) {
    return c.json({ error: 'You can only delete clips you uploaded' }, 403);
  }

  await purgeClipFromDatabase(c.env.DB, clipId);

  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(clipId);
  } catch (err) {
    console.error('deleteOwnClip broadcast:', err);
  }

  return c.json({ success: true }, 200);
}
