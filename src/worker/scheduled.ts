interface ScheduleItem {
  id: number;
  live_session_id: number;
  clip_id: number;
  order_index: number;
  duration: number | null;
  played_at: string | null;
}

interface LiveSession {
  id: number;
  status: string;
  current_clip_id: number | null;
  current_clip_started_at: string | null;
}

export async function handleScheduled(env: Env): Promise<void> {
  console.log('Running scheduled tasks...');

  try {
    // 1. Live session clip advancement
    await handleLiveSessionAdvancement(env);

    // 2. Performance optimization tasks
    await performanceOptimizations(env);

    console.log('All scheduled tasks completed successfully');
  } catch (error) {
    console.error('Error in scheduled tasks:', error);
  }
}

async function handleLiveSessionAdvancement(env: Env): Promise<void> {
  console.log('Running scheduled clip advancement check...');

  try {
    // Find all live sessions
    const sessions = await env.DB.prepare(
      `SELECT id, status, current_clip_id, current_clip_started_at 
       FROM live_sessions 
       WHERE status = 'live'`
    ).all();

    if (!sessions.results || sessions.results.length === 0) {
      console.log('No live sessions found');
      return;
    }

    for (const session of sessions.results) {
      await advanceClipIfNeeded(env.DB, session as unknown as LiveSession);
    }
  } catch (error) {
    console.error('Error in scheduled clip advancement:', error);
  }
}

async function performanceOptimizations(env: Env): Promise<void> {
  console.log('Running performance optimization tasks...');

  try {
    // Update trending scores for clips
    await updateTrendingScores(env);

    // Clean up old viewer heartbeats
    await cleanupOldViewers(env);

    // Clean up expired chat bans
    await cleanupExpiredBans(env);

    // Update live session statuses
    await updateLiveSessionStatuses(env);

    // Clean up expired rate limit records
    const { cleanupRateLimits } = await import('./rate-limiter');
    cleanupRateLimits();

    // Clean up old clip shares (older than 90 days)
    await cleanupOldShares(env);

    console.log('Performance optimization tasks completed');
  } catch (error) {
    console.error('Error in performance optimization tasks:', error);
  }
}

/**
 * Update trending scores for clips based on recent engagement
 * Engagement score: (likes × 1) + (comments × 3) + (shares × 5) + (views × 0.1)
 */
async function updateTrendingScores(env: Env): Promise<void> {
  console.log('Updating trending scores...');

  // Get shares count for each clip
  const sharesCount = await env.DB.prepare(
    `SELECT clip_id, COUNT(*) as shares
     FROM clip_shares
     GROUP BY clip_id`
  ).all();

  const sharesMap = new Map<number, number>();
  if (sharesCount.results) {
    for (const row of sharesCount.results as any[]) {
      sharesMap.set(row.clip_id, row.shares);
    }
  }

  // Update trending scores with shares included
  await env.DB.prepare(
    `UPDATE clips 
     SET is_trending_score = (
       (likes_count * 1.0) + 
       (comments_count * 3.0) + 
       (views_count * 0.1)
     ) / (1 + (julianday('now') - julianday(created_at)) * 0.5),
     updated_at = CURRENT_TIMESTAMP
     WHERE created_at >= date('now', '-30 days')`
  ).run();

  // Add shares to trending score separately (since it's in a different table)
  if (sharesCount.results && sharesCount.results.length > 0) {
    for (const row of sharesCount.results as any[]) {
      await env.DB.prepare(
        `UPDATE clips 
         SET is_trending_score = is_trending_score + (? * 5.0),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
        .bind(row.shares, row.clip_id)
        .run();
    }
  }

  // Reset old clips to 0
  await env.DB.prepare(
    `UPDATE clips 
     SET is_trending_score = 0.0,
     updated_at = CURRENT_TIMESTAMP
     WHERE created_at < date('now', '-30 days') 
     AND is_trending_score > 0`
  ).run();

  // Check for clips that crossed trending thresholds and send notifications
  await checkTrendingThresholds(env);

  console.log('Trending scores updated');
}

/**
 * Check if clips have crossed trending thresholds and notify users
 */
async function checkTrendingThresholds(env: Env): Promise<void> {
  console.log('Checking trending thresholds...');

  // Find clips that crossed 100 engagement in first 2 hours (Trending Now)
  const trendingNow = await env.DB.prepare(
    `SELECT id, mocha_user_id, artist_name, is_trending_score, created_at
     FROM clips
     WHERE is_trending_score >= 100
     AND (julianday('now') - julianday(created_at)) * 24 <= 2
     AND id NOT IN (
       SELECT related_clip_id FROM notifications 
       WHERE type = 'trending' 
       AND related_clip_id = clips.id
     )`
  ).all();

  for (const clip of (trendingNow.results || []) as any[]) {
    // Create trending notification
    await env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
       VALUES (?, 'trending', ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        clip.mocha_user_id,
        `Your clip is trending! 📈`,
        clip.id
      )
      .run();
  }

  // Find clips that crossed 500 engagement in first 24 hours (Momentum Live eligible)
  const momentumLiveEligible = await env.DB.prepare(
    `SELECT id, mocha_user_id, artist_name, is_trending_score, created_at
     FROM clips
     WHERE is_trending_score >= 500
     AND (julianday('now') - julianday(created_at)) * 24 <= 24
     AND id NOT IN (
       SELECT related_clip_id FROM notifications 
       WHERE type = 'momentum_live_eligible' 
       AND related_clip_id = clips.id
     )`
  ).all();

  for (const clip of (momentumLiveEligible.results || []) as any[]) {
    // Create Momentum Live eligible notification
    await env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
       VALUES (?, 'momentum_live_eligible', ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        clip.mocha_user_id,
        `Your ${clip.artist_name ? clip.artist_name + ' ' : ''}clip is fire! 🔥 It may be featured on Momentum Live`,
        clip.id
      )
      .run();
  }

  console.log('Trending thresholds checked');
}

/**
 * Remove old viewer heartbeats
 */
async function cleanupOldViewers(env: Env): Promise<void> {
  console.log('Cleaning up old viewers...');

  await env.DB.prepare(
    `DELETE FROM live_session_viewers 
     WHERE last_heartbeat < datetime('now', '-5 minutes')`
  ).run();

  console.log('Old viewers cleaned up');
}

/**
 * Remove expired chat bans
 */
async function cleanupExpiredBans(env: Env): Promise<void> {
  console.log('Cleaning up expired bans...');

  await env.DB.prepare(
    `DELETE FROM live_chat_bans 
     WHERE expires_at IS NOT NULL 
     AND expires_at < datetime('now')`
  ).run();

  console.log('Expired bans cleaned up');
}

/**
 * Update live session statuses
 */
async function updateLiveSessionStatuses(env: Env): Promise<void> {
  console.log('Updating live session statuses...');

  // End sessions that have passed their end time
  await env.DB.prepare(
    `UPDATE live_sessions 
     SET status = 'ended', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'live' 
     AND end_time < datetime('now')`
  ).run();

  // Start sessions that are scheduled to begin
  await env.DB.prepare(
    `UPDATE live_sessions 
     SET status = 'live', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'scheduled' 
     AND start_time <= datetime('now')
     AND end_time > datetime('now')`
  ).run();

  console.log('Live session statuses updated');
}

async function advanceClipIfNeeded(db: Env['DB'], session: LiveSession): Promise<void> {
  console.log(`Checking session ${session.id}...`);

  // If no current clip, start the first one
  if (!session.current_clip_id) {
    await startFirstClip(db, session.id);
    return;
  }

  // Get the current clip schedule item
  const currentScheduleItem = await db.prepare(
    `SELECT id, clip_id, duration, played_at 
     FROM live_session_clips 
     WHERE live_session_id = ? AND clip_id = ?`
  )
    .bind(session.id, session.current_clip_id)
    .first() as ScheduleItem | null;

  if (!currentScheduleItem) {
    console.log(`Current clip not found in schedule for session ${session.id}`);
    return;
  }

  // If clip has no duration set, default to 3 minutes (180 seconds)
  const clipDuration = currentScheduleItem.duration || 180;
  
  // Check if current clip has exceeded its duration
  if (session.current_clip_started_at) {
    const startTime = new Date(session.current_clip_started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000); // in seconds

    console.log(`Session ${session.id}: Clip has been playing for ${elapsed}s (duration: ${clipDuration}s)`);

    if (elapsed >= clipDuration) {
      // Time to advance to next clip
      await advanceToNextClip(db, session.id, currentScheduleItem);
    }
  } else {
    // No start time recorded, set it now
    await db.prepare(
      `UPDATE live_sessions 
       SET current_clip_started_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    )
      .bind(session.id)
      .run();
    console.log(`Set start time for current clip in session ${session.id}`);
  }
}

async function startFirstClip(db: Env['DB'], sessionId: number): Promise<void> {
  console.log(`Starting first clip for session ${sessionId}...`);

  // Get the first unplayed clip
  const firstClip = await db.prepare(
    `SELECT id, clip_id 
     FROM live_session_clips 
     WHERE live_session_id = ? AND played_at IS NULL 
     ORDER BY order_index ASC 
     LIMIT 1`
  )
    .bind(sessionId)
    .first() as ScheduleItem | null;

  if (!firstClip) {
    console.log(`No clips in schedule for session ${sessionId}`);
    return;
  }

  // Update session with current clip
  await db.prepare(
    `UPDATE live_sessions 
     SET current_clip_id = ?, current_clip_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind(firstClip.clip_id, sessionId)
    .run();

  console.log(`Started clip ${firstClip.clip_id} for session ${sessionId}`);
}

async function advanceToNextClip(
  db: Env['DB'], 
  sessionId: number, 
  currentScheduleItem: ScheduleItem
): Promise<void> {
  console.log(`Advancing to next clip for session ${sessionId}...`);

  // Mark current clip as played
  await db.prepare(
    `UPDATE live_session_clips 
     SET played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind(currentScheduleItem.id)
    .run();

  // Get next unplayed clip
  const nextClip = await db.prepare(
    `SELECT id, clip_id 
     FROM live_session_clips 
     WHERE live_session_id = ? AND played_at IS NULL 
     ORDER BY order_index ASC 
     LIMIT 1`
  )
    .bind(sessionId)
    .first() as ScheduleItem | null;

  if (!nextClip) {
    console.log(`No more clips in schedule for session ${sessionId}, ending session`);
    // End the session
    await db.prepare(
      `UPDATE live_sessions 
       SET status = 'ended', current_clip_id = NULL, current_clip_started_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    )
      .bind(sessionId)
      .run();
    return;
  }

  // Update session with next clip
  await db.prepare(
    `UPDATE live_sessions 
     SET current_clip_id = ?, current_clip_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind(nextClip.clip_id, sessionId)
    .run();

  console.log(`Advanced to clip ${nextClip.clip_id} for session ${sessionId}`);
}

/**
 * Clean up old clip shares to keep database optimized
 */
async function cleanupOldShares(env: Env): Promise<void> {
  console.log('Cleaning up old shares...');

  await env.DB.prepare(
    `DELETE FROM clip_shares 
     WHERE created_at < datetime('now', '-90 days')`
  ).run();

  console.log('Old shares cleaned up');
}
