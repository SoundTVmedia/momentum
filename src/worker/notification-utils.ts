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

export type UserNotificationOptions = {
  type: string;
  content: string;
  related_user_id?: string | null;
  related_clip_id?: number | null;
  related_comment_id?: number | null;
};

/** Compare Mocha user ids whether stored as number or string. */
export function isSameMochaUser(a: unknown, b: unknown): boolean {
  return (
    mochaUserIdKey({ id: a }).toLowerCase() === mochaUserIdKey({ id: b }).toLowerCase()
  );
}

/** In-app notification for one recipient (clip owner, followed user, etc.). */
export async function notifyUser(
  env: Env,
  recipientUserId: string,
  options: UserNotificationOptions,
): Promise<void> {
  const recipient = String(recipientUserId ?? '').trim();
  if (!recipient) return;

  const actorId =
    options.related_user_id != null && String(options.related_user_id).trim()
      ? String(options.related_user_id).trim()
      : null;

  try {
    const insert = await env.DB.prepare(
      `INSERT INTO notifications (
         mocha_user_id, type, content, related_user_id,
         related_clip_id, related_comment_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(
        recipient,
        options.type,
        options.content,
        actorId,
        options.related_clip_id ?? null,
        options.related_comment_id ?? null,
      )
      .run();

    const nid = parseD1LastRowId(insert.meta.last_row_id);
    if (nid == null) return;

    const row = await fetchNotificationRow(env.DB, nid);
    if (row) {
      const realtime = createRealtimeService(env);
      await realtime.broadcastNotification(recipient, row);
    }
  } catch (err) {
    console.error('notifyUser:', err);
  }
}

/** Notify everyone who follows the actor (e.g. optional fan-out; not used for likes/comments). */
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

/** Recipient keys for notifications (Mocha may use number or string ids in D1). */
export function notificationRecipientKeys(user: { id: unknown }): string[] {
  const uid = mochaUserIdKey(user);
  const raw = String(user.id ?? '').trim();
  if (!raw) return [uid];
  if (raw === uid) return [uid];
  return [uid, raw];
}

/** Placeholders for `mocha_user_id IN (...)` */
export function notificationRecipientPlaceholders(count: number): string {
  return Array.from({ length: Math.max(1, count) }, () => '?').join(', ');
}
