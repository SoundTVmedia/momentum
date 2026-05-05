import { Context } from 'hono';
import { createRealtimeService } from './realtime-service';

/**
 * Live Polls Endpoints for MOMENTUM Live
 */

// Create a poll during live session
export async function createLivePoll(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!userProfile.is_admin && !userProfile.is_moderator)) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }

  const body = await c.req.json();
  const { live_session_id, question, options } = body;

  if (!live_session_id || !question || !options || !Array.isArray(options) || options.length < 2) {
    return c.json({ error: "live_session_id, question, and at least 2 options are required" }, 400);
  }

  // Check if session is live
  const session = await c.env.DB.prepare(
    "SELECT id FROM live_sessions WHERE id = ? AND status = 'live'"
  )
    .bind(live_session_id)
    .first();

  if (!session) {
    return c.json({ error: "Live session not found or not active" }, 404);
  }

  // End any active polls for this session
  await c.env.DB.prepare(
    `UPDATE live_polls 
     SET is_active = 0, ended_at = CURRENT_TIMESTAMP 
     WHERE live_session_id = ? AND is_active = 1`
  )
    .bind(live_session_id)
    .run();

  // Create new poll
  const result = await c.env.DB.prepare(
    `INSERT INTO live_polls (live_session_id, question, options, created_by, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(live_session_id, question, JSON.stringify(options), mochaUser.id)
    .run();

  const newPoll = await c.env.DB.prepare(
    `SELECT * FROM live_polls WHERE id = ?`
  )
    .bind(result.meta.last_row_id)
    .first();

  // Broadcast poll to viewers
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(parseInt(live_session_id), {
      type: 'poll_created',
      poll: {
        ...newPoll,
        options: JSON.parse((newPoll as any).options),
      },
    });
  } catch (err) {
    console.error('Failed to broadcast poll:', err);
  }

  return c.json({
    ...newPoll,
    options: JSON.parse((newPoll as any).options),
  }, 201);
}

// Vote on a poll
export async function voteOnPoll(c: Context) {
  const mochaUser = c.get("user");
  const pollId = c.req.param('pollId');
  const body = await c.req.json();
  const { option_index } = body;

  if (!pollId) {
    return c.json({ error: "pollId is required" }, 400);
  }

  if (typeof option_index !== 'number') {
    return c.json({ error: "option_index is required" }, 400);
  }

  // Get poll
  const poll = await c.env.DB.prepare(
    `SELECT id, live_session_id, options, is_active FROM live_polls WHERE id = ?`
  )
    .bind(pollId)
    .first();

  if (!poll) {
    return c.json({ error: "Poll not found" }, 404);
  }

  if (!poll.is_active) {
    return c.json({ error: "Poll is no longer active" }, 400);
  }

  const options = JSON.parse((poll as any).options);
  if (option_index < 0 || option_index >= options.length) {
    return c.json({ error: "Invalid option_index" }, 400);
  }

  const userId = mochaUser?.id || null;

  // Check if already voted
  const existingVote = await c.env.DB.prepare(
    `SELECT id FROM live_poll_votes WHERE poll_id = ? AND mocha_user_id ${userId ? '= ?' : 'IS NULL'}`
  )
    .bind(userId ? pollId : pollId, userId || undefined)
    .first();

  if (existingVote) {
    return c.json({ error: "You have already voted on this poll" }, 400);
  }

  // Cast vote
  await c.env.DB.prepare(
    `INSERT INTO live_poll_votes (poll_id, mocha_user_id, option_index, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(pollId, userId, option_index)
    .run();

  // Get updated results
  const results = await getPollResults(c.env, parseInt(pollId, 10));

  // Broadcast updated results
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(poll.live_session_id as number, {
      type: 'poll_updated',
      poll_id: pollId,
      results,
    });
  } catch (err) {
    console.error('Failed to broadcast poll update:', err);
  }

  return c.json({ success: true, results });
}

// Get poll results
export async function getLivePollResults(c: Context) {
  const pollId = c.req.param('pollId');

  if (!pollId) {
    return c.json({ error: "pollId is required" }, 400);
  }

  const results = await getPollResults(c.env, parseInt(pollId, 10));

  return c.json(results);
}

// Get active poll for session
export async function getActivePoll(c: Context) {
  const sessionId = c.req.param('sessionId');

  const poll = await c.env.DB.prepare(
    `SELECT * FROM live_polls WHERE live_session_id = ? AND is_active = 1 LIMIT 1`
  )
    .bind(sessionId)
    .first();

  if (!poll) {
    return c.json({ poll: null });
  }

  const results = await getPollResults(c.env, (poll as any).id);

  return c.json({
    poll: {
      ...poll,
      options: JSON.parse((poll as any).options),
      results,
    },
  });
}

// End poll
export async function endLivePoll(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!userProfile.is_admin && !userProfile.is_moderator)) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }

  const pollId = c.req.param('pollId');

  if (!pollId) {
    return c.json({ error: "pollId is required" }, 400);
  }

  const poll = await c.env.DB.prepare(
    `SELECT live_session_id FROM live_polls WHERE id = ?`
  )
    .bind(pollId)
    .first();

  if (!poll) {
    return c.json({ error: "Poll not found" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE live_polls SET is_active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(pollId)
    .run();

  const results = await getPollResults(c.env, parseInt(pollId, 10));

  // Broadcast poll ended
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage((poll as any).live_session_id, {
      type: 'poll_ended',
      poll_id: pollId,
      results,
    });
  } catch (err) {
    console.error('Failed to broadcast poll end:', err);
  }

  return c.json({ success: true, results });
}

// Helper function to get poll results
async function getPollResults(env: Env, pollId: number) {
  const poll = await env.DB.prepare(
    `SELECT options FROM live_polls WHERE id = ?`
  )
    .bind(pollId)
    .first();

  if (!poll) {
    return null;
  }

  const options = JSON.parse((poll as any).options);
  
  const votes = await env.DB.prepare(
    `SELECT option_index, COUNT(*) as count 
     FROM live_poll_votes 
     WHERE poll_id = ?
     GROUP BY option_index`
  )
    .bind(pollId)
    .all();

  const totalVotes = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM live_poll_votes WHERE poll_id = ?`
  )
    .bind(pollId)
    .first() as { count: number } | null;

  const total = totalVotes?.count || 0;

  const results = options.map((_option: string, index: number) => {
    const voteCount = (votes.results || []).find((v: any) => v.option_index === index);
    const count = voteCount ? (voteCount as any).count : 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      option_index: index,
      votes: count,
      percentage,
    };
  });

  return {
    total_votes: total,
    results,
  };
}
