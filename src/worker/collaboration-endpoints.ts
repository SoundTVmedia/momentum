import { Context } from "hono";

/**
 * Create a collaboration request from artist to influencer
 */
export async function createCollaborationRequest(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || userProfile.role !== 'artist') {
    return c.json({ error: "Only artists can create collaboration requests" }, 403);
  }

  const body = await c.req.json();
  const { influencer_user_id, brief, compensation, deadline } = body;

  if (!influencer_user_id || !brief || !compensation || !deadline) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Check if influencer exists and is actually an influencer
  const influencer = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(influencer_user_id)
    .first();

  if (!influencer || influencer.role !== 'influencer') {
    return c.json({ error: "Invalid influencer" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO collaboration_requests (
      artist_user_id, 
      influencer_user_id, 
      brief, 
      compensation, 
      deadline,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(mochaUser.id, influencer_user_id, brief, compensation, deadline)
    .run();

  // Create notification for influencer
  await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
     VALUES (?, 'collaboration', ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(
      influencer_user_id,
      'sent you a collaboration request',
      mochaUser.id
    )
    .run();

  return c.json({ 
    success: true,
    requestId: result.meta.last_row_id
  }, 201);
}

/**
 * Get collaboration requests for current user
 */
export async function getCollaborationRequests(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  let requests;

  if (userProfile.role === 'influencer') {
    // Get requests sent to this influencer
    requests = await c.env.DB.prepare(
      `SELECT 
        collaboration_requests.*,
        user_profiles.display_name as artist_name,
        user_profiles.profile_image_url as artist_avatar
      FROM collaboration_requests
      LEFT JOIN user_profiles ON collaboration_requests.artist_user_id = user_profiles.mocha_user_id
      WHERE collaboration_requests.influencer_user_id = ?
      ORDER BY collaboration_requests.created_at DESC`
    )
      .bind(mochaUser.id)
      .all();
  } else if (userProfile.role === 'artist') {
    // Get requests sent by this artist
    requests = await c.env.DB.prepare(
      `SELECT 
        collaboration_requests.*,
        user_profiles.display_name as influencer_name,
        user_profiles.profile_image_url as influencer_avatar
      FROM collaboration_requests
      LEFT JOIN user_profiles ON collaboration_requests.influencer_user_id = user_profiles.mocha_user_id
      WHERE collaboration_requests.artist_user_id = ?
      ORDER BY collaboration_requests.created_at DESC`
    )
      .bind(mochaUser.id)
      .all();
  } else {
    return c.json({ requests: [] });
  }

  return c.json({ requests: requests.results || [] });
}

/**
 * Accept a collaboration request
 */
export async function acceptCollaborationRequest(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const requestId = c.req.param('requestId');

  // Get the request
  const request = await c.env.DB.prepare(
    "SELECT * FROM collaboration_requests WHERE id = ?"
  )
    .bind(requestId)
    .first();

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  // Check if user is the influencer
  if (request.influencer_user_id !== mochaUser.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Update status
  await c.env.DB.prepare(
    `UPDATE collaboration_requests 
     SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind(requestId)
    .run();

  // Create notification for artist
  await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
     VALUES (?, 'collaboration', ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(
      request.artist_user_id,
      'accepted your collaboration request',
      mochaUser.id
    )
    .run();

  return c.json({ success: true });
}

/**
 * Reject a collaboration request
 */
export async function rejectCollaborationRequest(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const requestId = c.req.param('requestId');

  const request = await c.env.DB.prepare(
    "SELECT * FROM collaboration_requests WHERE id = ?"
  )
    .bind(requestId)
    .first();

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  if (request.influencer_user_id !== mochaUser.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  await c.env.DB.prepare(
    `UPDATE collaboration_requests 
     SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind(requestId)
    .run();

  return c.json({ success: true });
}

/**
 * Pin a clip to artist page
 */
export async function pinClipToArtist(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const clipId = c.req.param('clipId');

  // Get clip to find artist
  const clip = await c.env.DB.prepare(
    "SELECT artist_name FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip || !clip.artist_name) {
    return c.json({ error: "Clip not found or has no artist" }, 404);
  }

  // Get artist record
  const artist = await c.env.DB.prepare(
    "SELECT id FROM artists WHERE name = ?"
  )
    .bind(clip.artist_name)
    .first();

  if (!artist) {
    return c.json({ error: "Artist not found" }, 404);
  }

  // Verify user is artist or admin
  const userProfile = await c.env.DB.prepare(
    "SELECT role, is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (userProfile.role !== 'artist' && !userProfile.is_admin)) {
    return c.json({ error: "Only artists can pin clips" }, 403);
  }

  // Pin the clip
  await c.env.DB.prepare(
    `INSERT INTO artist_pinned_clips (artist_id, clip_id, pinned_by, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(artist_id, clip_id) DO NOTHING`
  )
    .bind(artist.id, clipId, mochaUser.id)
    .run();

  return c.json({ success: true });
}

/**
 * Unpin a clip from artist page
 */
export async function unpinClipFromArtist(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const clipId = c.req.param('clipId');

  await c.env.DB.prepare(
    "DELETE FROM artist_pinned_clips WHERE clip_id = ? AND pinned_by = ?"
  )
    .bind(clipId, mochaUser.id)
    .run();

  return c.json({ success: true });
}

/**
 * Get pinned clips for artist
 */
export async function getPinnedClips(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const pinnedClips = await c.env.DB.prepare(
    `SELECT clip_id 
     FROM artist_pinned_clips 
     WHERE pinned_by = ?`
  )
    .bind(mochaUser.id)
    .all();

  return c.json({ 
    pinnedClipIds: (pinnedClips.results || []).map((r: any) => r.clip_id)
  });
}
