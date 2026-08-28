import { Context } from 'hono';
import { purgeClip } from './clip-delete-utils';
import { getStaffProfile, isAdmin, isSuperAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';

// Get flagged clips for moderation
export async function getFlaggedClips(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const statusFilter = c.req.query('status') || 'pending';

  let query = `
    SELECT 
      clip_flags.*,
      clips.artist_name,
      clips.venue_name,
      clips.thumbnail_url,
      clips.video_url,
      clips.stream_video_id,
      clips.stream_playback_url,
      clips.stream_thumbnail_url,
      clips.playback_unplayable,
      clips.playback_unplayable_reason,
      clips.mocha_user_id as clip_user_id,
      reporter.display_name as reporter_display_name,
      clip_user.display_name as clip_user_display_name
    FROM clip_flags
    LEFT JOIN clips ON clip_flags.clip_id = clips.id
    LEFT JOIN user_profiles AS reporter ON clip_flags.reported_by = reporter.mocha_user_id
    LEFT JOIN user_profiles AS clip_user ON clips.mocha_user_id = clip_user.mocha_user_id
  `;

  const bindings: any[] = [];

  if (statusFilter !== 'all') {
    query += ` WHERE clip_flags.status = ?`;
    bindings.push(statusFilter);
  }

  query += ` ORDER BY clip_flags.is_urgent DESC, clip_flags.created_at DESC LIMIT 100`;

  const flags = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all();

  return c.json({ flaggedClips: flags.results || [] });
}

// Review a flagged clip
export async function reviewFlaggedClip(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const flagId = c.req.param('flagId');
  const body = await c.req.json();
  const { action } = body; // 'approve' or 'remove'

  if (!action || (action !== 'approve' && action !== 'remove')) {
    return c.json({ error: "Invalid action" }, 400);
  }

  // Get the flag
  const flag = await c.env.DB.prepare(
    "SELECT clip_id FROM clip_flags WHERE id = ?"
  )
    .bind(flagId)
    .first();

  if (!flag) {
    return c.json({ error: "Flag not found" }, 404);
  }

  if (action === 'approve') {
    // Mark flag as reviewed (approved - no action needed)
    await c.env.DB.prepare(
      `UPDATE clip_flags 
       SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(mochaUser.id, flagId)
      .run();
  } else {
    // Hide the clip and mark flag as removed
    await c.env.DB.prepare(
      "UPDATE clips SET is_hidden = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(flag.clip_id)
      .run();

    await c.env.DB.prepare(
      `UPDATE clip_flags 
       SET status = 'removed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(mochaUser.id, flagId)
      .run();
  }

  return c.json({ success: true });
}

async function requireAdmin(c: Context): Promise<Response | null> {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    'SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?',
  )
    .bind(mochaUserIdKey(mochaUser))
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  return null;
}

export async function getUnplayableClips(c: Context) {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const clips = await c.env.DB.prepare(
    `SELECT clips.id, clips.artist_name, clips.venue_name, clips.thumbnail_url,
            clips.stream_video_id, clips.stream_playback_url, clips.stream_thumbnail_url,
            clips.video_url, clips.mocha_user_id, clips.created_at, clips.is_hidden,
            clips.playback_unplayable, clips.playback_unplayable_reason,
            user_profiles.display_name AS user_display_name
     FROM clips
     LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
     WHERE COALESCE(clips.playback_unplayable, 0) = 1
     ORDER BY clips.updated_at DESC
     LIMIT 100`,
  ).all();

  return c.json({ clips: clips.results || [] });
}

// Reported comments queue
export async function getFlaggedComments(c: Context) {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const statusFilter = c.req.query('status') || 'pending';

  let query = `
    SELECT
      comment_flags.*,
      comments.content AS comment_content,
      comments.clip_id AS clip_id,
      comments.is_hidden AS comment_is_hidden,
      comments.mocha_user_id AS comment_user_id,
      author.display_name AS comment_user_display_name,
      author.profile_image_url AS comment_user_avatar,
      reporter.display_name AS reporter_display_name
    FROM comment_flags
    LEFT JOIN comments ON comment_flags.comment_id = comments.id
    LEFT JOIN user_profiles AS author ON comments.mocha_user_id = author.mocha_user_id
    LEFT JOIN user_profiles AS reporter ON comment_flags.reported_by = reporter.mocha_user_id
  `;

  const bindings: unknown[] = [];
  if (statusFilter !== 'all') {
    query += ' WHERE comment_flags.status = ?';
    bindings.push(statusFilter);
  }
  query += ' ORDER BY comment_flags.is_urgent DESC, comment_flags.created_at DESC LIMIT 100';

  const flags = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({ flaggedComments: flags.results || [] });
}

export async function reviewFlaggedComment(c: Context) {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const mochaUser = c.get('user');
  const flagId = c.req.param('flagId');
  const body = (await c.req.json()) as { action?: string };
  const action = body.action;

  if (action !== 'approve' && action !== 'remove') {
    return c.json({ error: 'Invalid action' }, 400);
  }

  const flag = (await c.env.DB.prepare('SELECT comment_id FROM comment_flags WHERE id = ?')
    .bind(flagId)
    .first()) as { comment_id: number } | null;

  if (!flag) {
    return c.json({ error: 'Flag not found' }, 404);
  }

  if (action === 'remove') {
    await c.env.DB.prepare('UPDATE comments SET is_hidden = 1 WHERE id = ?')
      .bind(flag.comment_id)
      .run();
  } else {
    // Approving clears an automatic removal (e.g. a report that turned out to be wrong).
    await c.env.DB.prepare('UPDATE comments SET is_hidden = 0 WHERE id = ?')
      .bind(flag.comment_id)
      .run();
  }

  await c.env.DB.prepare(
    `UPDATE comment_flags
     SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(action === 'remove' ? 'removed' : 'approved', mochaUserIdKey(mochaUser ?? { id: '' }), flagId)
    .run();

  return c.json({ success: true });
}

// Reported profiles queue
export async function getFlaggedProfiles(c: Context) {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const statusFilter = c.req.query('status') || 'pending';

  let query = `
    SELECT
      profile_flags.*,
      reported.display_name AS reported_display_name,
      reported.profile_image_url AS reported_avatar,
      reported.bio AS reported_bio,
      reporter.display_name AS reporter_display_name,
      COALESCE(
        (SELECT 1 FROM user_bans
         WHERE user_bans.mocha_user_id = profile_flags.reported_user_id
         AND (user_bans.expires_at IS NULL OR user_bans.expires_at > datetime('now'))
         LIMIT 1),
        0
      ) AS is_banned
    FROM profile_flags
    LEFT JOIN user_profiles AS reported ON profile_flags.reported_user_id = reported.mocha_user_id
    LEFT JOIN user_profiles AS reporter ON profile_flags.reported_by = reporter.mocha_user_id
  `;

  const bindings: unknown[] = [];
  if (statusFilter !== 'all') {
    query += ' WHERE profile_flags.status = ?';
    bindings.push(statusFilter);
  }
  query += ' ORDER BY profile_flags.is_urgent DESC, profile_flags.created_at DESC LIMIT 100';

  const flags = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({ flaggedProfiles: flags.results || [] });
}

/** Close a profile report. Bans stay a separate, explicit action. */
export async function reviewFlaggedProfile(c: Context) {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const mochaUser = c.get('user');
  const flagId = c.req.param('flagId');
  const body = (await c.req.json()) as { action?: string };
  const action = body.action;

  if (action !== 'approve' && action !== 'actioned') {
    return c.json({ error: 'Invalid action' }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE profile_flags
     SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(action === 'approve' ? 'approved' : 'actioned', mochaUserIdKey(mochaUser ?? { id: '' }), flagId)
    .run();

  return c.json({ success: true });
}

// Delete a clip permanently
export async function deleteClip(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));

  if (!isSuperAdmin(userProfile)) {
    return c.json({ error: "Superadmin access required" }, 403);
  }

  const clipIdParam = c.req.param('clipId');
  if (clipIdParam === undefined) {
    return c.json({ error: 'Invalid clip id' }, 400);
  }
  const clipId = Number.parseInt(clipIdParam, 10);
  if (Number.isNaN(clipId)) {
    return c.json({ error: 'Invalid clip id' }, 400);
  }

  await purgeClip(c.env, clipId);

  return c.json({ success: true });
}

// Get flagged users
export async function getFlaggedUsers(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
    return c.json({ error: "Admin access required" }, 403);
  }

  // Get users with multiple flags
  const flaggedUsers = await c.env.DB.prepare(
    `SELECT 
      clips.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(DISTINCT clip_flags.id) as flag_count,
      MAX(clip_flags.reason) as latest_flag_reason,
      COALESCE(
        (SELECT 1 FROM user_bans 
         WHERE user_bans.mocha_user_id = clips.mocha_user_id 
         AND (user_bans.expires_at IS NULL OR user_bans.expires_at > datetime('now'))
         LIMIT 1), 
        0
      ) as is_banned
    FROM clip_flags
    JOIN clips ON clip_flags.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clip_flags.status = 'pending'
    GROUP BY clips.mocha_user_id
    HAVING flag_count >= 1
    ORDER BY flag_count DESC
    LIMIT 100`
  ).all();

  return c.json({ flaggedUsers: flaggedUsers.results || [] });
}

// Ban a user
export async function banUser(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const userId = c.req.param('userId');
  const body = await c.req.json();
  const { duration_days, reason } = body;

  let expiresAt = null;
  if (duration_days) {
    const expires = new Date();
    expires.setDate(expires.getDate() + duration_days);
    expiresAt = expires.toISOString();
  }

  // Check if user already has an active ban
  const existingBan = await c.env.DB.prepare(
    `SELECT id FROM user_bans 
     WHERE mocha_user_id = ? 
     AND (expires_at IS NULL OR expires_at > datetime('now'))`
  )
    .bind(userId)
    .first();

  if (existingBan) {
    // Update existing ban
    await c.env.DB.prepare(
      `UPDATE user_bans 
       SET expires_at = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(expiresAt, reason || null, existingBan.id)
      .run();
  } else {
    // Create new ban
    await c.env.DB.prepare(
      `INSERT INTO user_bans (mocha_user_id, banned_by, reason, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(userId, mochaUser.id, reason || null, expiresAt)
      .run();
  }

  return c.json({ success: true });
}

// Unban a user
export async function unbanUser(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const userId = c.req.param('userId');

  await c.env.DB.prepare(
    "DELETE FROM user_bans WHERE mocha_user_id = ?"
  )
    .bind(userId)
    .run();

  return c.json({ success: true });
}
