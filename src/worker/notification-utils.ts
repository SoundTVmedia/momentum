import { createRealtimeService } from './realtime-service';
import { mochaUserIdKey, parseD1LastRowId } from './mocha-user-id';

export type NotifyFollowersOptions = {
  type: string;
  content: string;
  related_clip_id?: number | null;
  related_comment_id?: number | null;
  excludeUserIds?: string[];
};

/** Users who follow `followingUserId` (real accounts only, not venue-/artist- ids). */
export async function getFollowerIds(
  db: D1Database,
  followingUserId: string,
): Promise<string[]> {
  const key = String(followingUserId ?? '').trim();
  if (!key) return [];

  const rows = await db
    .prepare(
      `SELECT follower_id FROM follows
       WHERE following_id = ?
         AND follower_id NOT LIKE 'venue-%'
         AND follower_id NOT LIKE 'artist-%'
         AND follower_id NOT LIKE 'artist-name:%'`,
    )
    .bind(key)
    .all();

  return (rows.results || [])
    .map((r) => String((r as { follower_id?: unknown }).follower_id ?? '').trim())
    .filter(Boolean);
}

async function fetchNotificationRow(db: D1Database, notificationId: number) {
  return db
    .prepare(
      `SELECT
         notifications.*,
         user_profiles.display_name AS user_display_name,
         user_profiles.profile_image_url AS user_avatar
       FROM notifications
       LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
       WHERE notifications.id = ?`,
    )
    .bind(notificationId)
    .first();
}

/** Notify everyone who follows the actor (new clip, comment, like, etc.). */
export async function notifyFollowers(
  env: Env,
  actorUser: { id: unknown },
  options: NotifyFollowersOptions,
): Promise<void> {
  const actorUid = mochaUserIdKey(actorUser);
  const followers = await getFollowerIds(env.DB, actorUid);
  const exclude = new Set(
    [actorUid, ...(options.excludeUserIds ?? [])].map((id) => String(id).trim()),
  );

  const realtime = createRealtimeService(env);

  for (const followerId of followers) {
    if (exclude.has(followerId)) continue;

    try {
      const insert = await env.DB.prepare(
        `INSERT INTO notifications (
           mocha_user_id, type, content, related_user_id,
           related_clip_id, related_comment_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
        .bind(
          followerId,
          options.type,
          options.content,
          actorUid,
          options.related_clip_id ?? null,
          options.related_comment_id ?? null,
        )
        .run();

      const nid = parseD1LastRowId(insert.meta.last_row_id);
      if (nid == null) continue;

      const row = await fetchNotificationRow(env.DB, nid);
      if (row) {
        await realtime.broadcastNotification(followerId, row);
      }
    } catch (err) {
      console.error('notifyFollowers insert:', err);
    }
  }
}

/** SQL fragment: clip/comment/like only from followed users; keep system + follow alerts. */
export const NOTIFICATIONS_FROM_FOLLOWED_SQL = `
  (
    notifications.type IN ('follow', 'verification', 'trending', 'achievement', 'live')
    OR (
      notifications.type IN ('clip', 'comment', 'like')
      AND notifications.related_user_id IN (
        SELECT following_id FROM follows
        WHERE follower_id = ?
          AND following_id NOT LIKE 'venue-%'
          AND following_id NOT LIKE 'artist-%'
          AND following_id NOT LIKE 'artist-name:%'
      )
    )
  )
`;
