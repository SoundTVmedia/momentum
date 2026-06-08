/** Active platform suspension (distinct from live-chat-only bans). */
export async function isUserSuspended(db: D1Database, mochaUserId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM user_bans
       WHERE mocha_user_id = ?
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       LIMIT 1`,
    )
    .bind(mochaUserId)
    .first();

  return !!row;
}

export async function suspendUser(
  db: D1Database,
  targetUserId: string,
  suspendedBy: string,
  opts: { durationDays?: number | null; reason?: string | null } = {},
): Promise<void> {
  let expiresAt: string | null = null;
  if (opts.durationDays != null && opts.durationDays > 0) {
    const expires = new Date();
    expires.setDate(expires.getDate() + opts.durationDays);
    expiresAt = expires.toISOString();
  }

  const existingBan = await db
    .prepare(
      `SELECT id FROM user_bans
       WHERE mocha_user_id = ?
       AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    )
    .bind(targetUserId)
    .first<{ id: number }>();

  if (existingBan) {
    await db
      .prepare(
        `UPDATE user_bans
         SET expires_at = ?, reason = ?, banned_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(expiresAt, opts.reason ?? null, suspendedBy, existingBan.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO user_bans (mocha_user_id, banned_by, reason, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(targetUserId, suspendedBy, opts.reason ?? null, expiresAt)
      .run();
  }
}

export async function unsuspendUser(db: D1Database, targetUserId: string): Promise<void> {
  await db.prepare('DELETE FROM user_bans WHERE mocha_user_id = ?').bind(targetUserId).run();
}
