import { Context } from 'hono';

// Report/flag a clip
export async function reportClip(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const clipId = c.req.param('clipId');
  const body = await c.req.json();
  const { reason } = body;

  if (!reason || !reason.trim()) {
    return c.json({ error: "Report reason is required" }, 400);
  }

  // Check if clip exists
  const clip = await c.env.DB.prepare(
    "SELECT id FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Check if user already reported this clip
  const existingFlag = await c.env.DB.prepare(
    "SELECT id FROM clip_flags WHERE clip_id = ? AND reported_by = ?"
  )
    .bind(clipId, mochaUser.id)
    .first();

  if (existingFlag) {
    return c.json({ error: "You have already reported this clip" }, 400);
  }

  // Create flag
  await c.env.DB.prepare(
    `INSERT INTO clip_flags (clip_id, reported_by, reason, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(clipId, mochaUser.id, reason.trim())
    .run();

  return c.json({ success: true }, 201);
}

// Get flagged clips for moderation
export async function getFlaggedClips(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
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

  query += ` ORDER BY clip_flags.created_at DESC LIMIT 100`;

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
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
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

// Delete a clip permanently
export async function deleteClip(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const clipId = c.req.param('clipId');

  // Delete associated data
  await c.env.DB.prepare("DELETE FROM clip_likes WHERE clip_id = ?").bind(clipId).run();
  await c.env.DB.prepare("DELETE FROM comments WHERE clip_id = ?").bind(clipId).run();
  await c.env.DB.prepare("DELETE FROM saved_clips WHERE clip_id = ?").bind(clipId).run();
  await c.env.DB.prepare("DELETE FROM clip_flags WHERE clip_id = ?").bind(clipId).run();
  await c.env.DB.prepare("DELETE FROM live_session_clips WHERE clip_id = ?").bind(clipId).run();
  await c.env.DB.prepare("DELETE FROM clips WHERE id = ?").bind(clipId).run();

  return c.json({ success: true });
}

// Get flagged users
export async function getFlaggedUsers(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
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
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
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
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
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
