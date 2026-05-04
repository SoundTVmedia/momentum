/**
 * Permanently remove a clip and dependent rows (likes, comments, saves, etc.).
 * Used by owner self-delete and admin moderation delete.
 */
export async function purgeClipFromDatabase(db: D1Database, clipId: number): Promise<void> {
  const id = clipId;

  await db
    .prepare(
      `UPDATE live_sessions
       SET current_clip_id = NULL, current_clip_started_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE current_clip_id = ?`
    )
    .bind(id)
    .run();

  await db.prepare('DELETE FROM notifications WHERE related_clip_id = ?').bind(id).run();
  await db
    .prepare(
      `DELETE FROM notifications WHERE related_comment_id IN (SELECT id FROM comments WHERE clip_id = ?)`
    )
    .bind(id)
    .run();

  await db
    .prepare(
      `DELETE FROM point_transactions
       WHERE related_clip_id = ?
          OR related_comment_id IN (SELECT id FROM comments WHERE clip_id = ?)`
    )
    .bind(id, id)
    .run();

  await db.prepare('DELETE FROM clip_likes WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM saved_clips WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM clip_ratings WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM clip_flags WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM clip_shares WHERE clip_id = ?').bind(id).run();
  await db
    .prepare('DELETE FROM user_favorite_clips_by_artist WHERE clip_id = ?')
    .bind(id)
    .run();
  await db.prepare('DELETE FROM artist_pinned_clips WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM live_featured_clips WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM live_session_clips WHERE clip_id = ?').bind(id).run();

  await db.prepare('DELETE FROM comments WHERE clip_id = ?').bind(id).run();
  await db.prepare('DELETE FROM clips WHERE id = ?').bind(id).run();
}
