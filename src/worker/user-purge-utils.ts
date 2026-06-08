import { MOCHA_USER_ID_TABLES } from './account-linking';
import { purgeClipFromDatabase } from './clip-delete-utils';
import { revokeAllEmailSessionsForUser } from './hybrid-auth';

async function revokeAllGoogleSessionsForUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM google_sessions WHERE user_id = ?').bind(userId).run();
}

export async function purgeUserClips(db: D1Database, userId: string): Promise<void> {
  const clips = await db
    .prepare('SELECT id FROM clips WHERE mocha_user_id = ?')
    .bind(userId)
    .all();

  for (const clip of clips.results || []) {
    const id = (clip as { id: number }).id;
    if (typeof id === 'number' && Number.isFinite(id)) {
      await purgeClipFromDatabase(db, id);
    }
  }
}

/**
 * Permanently remove a user and their data. Clips are deleted by default.
 */
export async function purgeUserAccount(
  db: D1Database,
  userId: string,
  opts: { deleteClips?: boolean } = {},
): Promise<void> {
  const deleteClips = opts.deleteClips !== false;

  if (deleteClips) {
    await purgeUserClips(db, userId);
  } else {
    await db
      .prepare("UPDATE clips SET mocha_user_id = 'deleted_user' WHERE mocha_user_id = ?")
      .bind(userId)
      .run();
  }

  await db
    .prepare("UPDATE comments SET mocha_user_id = 'deleted_user' WHERE mocha_user_id = ?")
    .bind(userId)
    .run();

  for (const table of MOCHA_USER_ID_TABLES) {
    try {
      await db.prepare(`DELETE FROM ${table} WHERE mocha_user_id = ?`).bind(userId).run();
    } catch (e) {
      console.warn(`purgeUserAccount: could not clear ${table}`, e);
    }
  }

  await db.prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?').bind(userId, userId).run();
  await db.prepare('DELETE FROM clip_flags WHERE reported_by = ?').bind(userId).run();
  await db
    .prepare('DELETE FROM live_chat_bans WHERE mocha_user_id = ? OR banned_by = ?')
    .bind(userId, userId)
    .run();
  await db.prepare('DELETE FROM user_profiles WHERE mocha_user_id = ?').bind(userId).run();

  await revokeAllEmailSessionsForUser(db, userId);
  await revokeAllGoogleSessionsForUser(db, userId);
  await db.prepare('DELETE FROM email_password_resets WHERE user_id = ?').bind(userId).run();
  await db.prepare('DELETE FROM email_accounts WHERE id = ?').bind(userId).run();
  await db.prepare('DELETE FROM google_accounts WHERE id = ?').bind(userId).run();
}
