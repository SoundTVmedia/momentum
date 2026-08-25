import type { Context } from 'hono';
import {
  MAX_REPORT_DETAILS_LENGTH,
  isReportReasonCode,
  reasonRequiresImmediateRemoval,
  reasonRequiresUrgentReview,
  reportReasonLabel,
} from '@/shared/report-reasons';
import { mochaUserIdKey } from './mocha-user-id';
import { resolveResendApiKey, resolveTransactionalEmailFrom } from './transactional-email-config';
import { SUPPORT_INBOX_EMAIL, sendUrgentReportEmail } from './support-email';
import { blockKey, getBlockDirections, isBlockedBetween } from './user-blocks';

type ReportInput = {
  reason: string;
  details: string | null;
};

async function parseReportBody(c: Context): Promise<ReportInput | { error: string }> {
  let body: { reason?: unknown; details?: unknown };
  try {
    body = (await c.req.json()) as { reason?: unknown; details?: unknown };
  } catch {
    return { error: 'Invalid request body' };
  }

  if (!isReportReasonCode(body.reason)) {
    return { error: 'Pick a reason for this report' };
  }

  const rawDetails = typeof body.details === 'string' ? body.details.trim() : '';
  if (rawDetails.length > MAX_REPORT_DETAILS_LENGTH) {
    return { error: `Details must be ${MAX_REPORT_DETAILS_LENGTH} characters or fewer` };
  }

  return { reason: body.reason, details: rawDetails || null };
}

/**
 * Alerts the founders for reports that jump the queue. Never throws: a mail outage must not
 * stop us recording the report or telling the reporter it landed.
 */
async function alertFoundersOfUrgentReport(
  c: Context<{ Bindings: Env }>,
  opts: { subject: string; lines: string[] },
): Promise<void> {
  try {
    const apiKey = resolveResendApiKey(c.env);
    if (!apiKey) {
      console.warn('[urgent report] RESEND_API_KEY unset —', opts.subject, opts.lines.join(' | '));
      return;
    }
    await sendUrgentReportEmail({
      apiKey,
      from: resolveTransactionalEmailFrom(c.env),
      to: SUPPORT_INBOX_EMAIL,
      subject: opts.subject,
      lines: opts.lines,
    });
  } catch (err) {
    console.error('alertFoundersOfUrgentReport:', err);
  }
}

/** Report a clip. Reasons come from the published taxonomy in `@/shared/report-reasons`. */
export async function reportClip(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parsed = await parseReportBody(c);
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const clipId = c.req.param('clipId');
  const reporterId = mochaUserIdKey(mochaUser);

  const clip = await c.env.DB.prepare('SELECT id, mocha_user_id FROM clips WHERE id = ?')
    .bind(clipId)
    .first<{ id: number; mocha_user_id: string }>();

  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  const existingFlag = await c.env.DB.prepare(
    'SELECT id FROM clip_flags WHERE clip_id = ? AND reported_by = ?',
  )
    .bind(clipId, reporterId)
    .first();

  if (existingFlag) {
    return c.json({ error: 'You have already reported this clip' }, 400);
  }

  const urgent = reasonRequiresUrgentReview(parsed.reason);

  await c.env.DB.prepare(
    `INSERT INTO clip_flags (clip_id, reported_by, reason, details, status, is_urgent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
    .bind(clipId, reporterId, parsed.reason, parsed.details, urgent ? 1 : 0)
    .run();

  if (reasonRequiresImmediateRemoval(parsed.reason)) {
    await c.env.DB.prepare(
      'UPDATE clips SET is_hidden = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
      .bind(clip.id)
      .run();
  }

  if (urgent) {
    await alertFoundersOfUrgentReport(c, {
      subject: `[URGENT] Clip reported: ${reportReasonLabel(parsed.reason)}`,
      lines: [
        `Reason: ${reportReasonLabel(parsed.reason)}`,
        `Clip id: ${clip.id}`,
        `Posted by: ${clip.mocha_user_id}`,
        `Reported by: ${reporterId}`,
        reasonRequiresImmediateRemoval(parsed.reason)
          ? 'The clip has been hidden automatically pending review.'
          : 'The clip is still visible; review it ahead of the queue.',
        '',
        `Details: ${parsed.details ?? '(none)'}`,
      ],
    });
  }

  return c.json({ success: true, authorId: clip.mocha_user_id }, 201);
}

export async function reportComment(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parsed = await parseReportBody(c);
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const commentId = c.req.param('commentId');
  const reporterId = mochaUserIdKey(mochaUser);

  const comment = await c.env.DB.prepare(
    'SELECT id, mocha_user_id, clip_id FROM comments WHERE id = ?',
  )
    .bind(commentId)
    .first<{ id: number; mocha_user_id: string; clip_id: number }>();

  if (!comment) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  if (blockKey(comment.mocha_user_id) === blockKey(reporterId)) {
    return c.json({ error: 'You cannot report your own comment' }, 400);
  }

  const existingFlag = await c.env.DB.prepare(
    'SELECT id FROM comment_flags WHERE comment_id = ? AND reported_by = ?',
  )
    .bind(commentId, reporterId)
    .first();

  if (existingFlag) {
    return c.json({ error: 'You have already reported this comment' }, 400);
  }

  const urgent = reasonRequiresUrgentReview(parsed.reason);

  await c.env.DB.prepare(
    `INSERT INTO comment_flags (comment_id, reported_by, reason, details, status, is_urgent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
    .bind(commentId, reporterId, parsed.reason, parsed.details, urgent ? 1 : 0)
    .run();

  // Quarantine every reported comment until a superadmin explicitly approves it.
  await c.env.DB.prepare('UPDATE comments SET is_hidden = 1 WHERE id = ?')
    .bind(comment.id)
    .run();

  if (urgent) {
    await alertFoundersOfUrgentReport(c, {
      subject: `[URGENT] Comment reported: ${reportReasonLabel(parsed.reason)}`,
      lines: [
        `Reason: ${reportReasonLabel(parsed.reason)}`,
        `Comment id: ${comment.id} (clip ${comment.clip_id})`,
        `Posted by: ${comment.mocha_user_id}`,
        `Reported by: ${reporterId}`,
        '',
        `Details: ${parsed.details ?? '(none)'}`,
      ],
    });
  }

  return c.json({ success: true, authorId: comment.mocha_user_id }, 201);
}

export async function reportUserProfile(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parsed = await parseReportBody(c);
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const reportedUserId = c.req.param('userId') ?? '';
  const reporterId = mochaUserIdKey(mochaUser);

  if (blockKey(reportedUserId) === blockKey(reporterId)) {
    return c.json({ error: 'You cannot report your own profile' }, 400);
  }

  const profile = await c.env.DB.prepare(
    'SELECT mocha_user_id FROM user_profiles WHERE mocha_user_id = ?',
  )
    .bind(reportedUserId)
    .first();

  if (!profile) {
    return c.json({ error: 'User not found' }, 404);
  }

  const existingFlag = await c.env.DB.prepare(
    'SELECT id FROM profile_flags WHERE reported_user_id = ? AND reported_by = ?',
  )
    .bind(reportedUserId, reporterId)
    .first();

  if (existingFlag) {
    return c.json({ error: 'You have already reported this account' }, 400);
  }

  const urgent = reasonRequiresUrgentReview(parsed.reason);

  await c.env.DB.prepare(
    `INSERT INTO profile_flags (reported_user_id, reported_by, reason, details, status, is_urgent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
    .bind(reportedUserId, reporterId, parsed.reason, parsed.details, urgent ? 1 : 0)
    .run();

  if (urgent) {
    await alertFoundersOfUrgentReport(c, {
      subject: `[URGENT] Account reported: ${reportReasonLabel(parsed.reason)}`,
      lines: [
        `Reason: ${reportReasonLabel(parsed.reason)}`,
        `Account: ${reportedUserId}`,
        `Reported by: ${reporterId}`,
        '',
        `Details: ${parsed.details ?? '(none)'}`,
      ],
    });
  }

  return c.json({ success: true }, 201);
}

/** Block hides both directions and drops any follow relationship in either direction. */
export async function blockUser(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = (c.req.param('userId') ?? '').trim();
  const viewerId = mochaUserIdKey(mochaUser);

  if (!targetId) {
    return c.json({ error: 'Invalid account' }, 400);
  }
  if (blockKey(targetId) === blockKey(viewerId)) {
    return c.json({ error: 'You cannot block yourself' }, 400);
  }

  const profile = await c.env.DB.prepare(
    'SELECT mocha_user_id FROM user_profiles WHERE mocha_user_id = ?',
  )
    .bind(targetId)
    .first();

  if (!profile) {
    return c.json({ error: 'User not found' }, 404);
  }

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
  )
    .bind(viewerId, targetId)
    .run();

  await c.env.DB.prepare(
    `DELETE FROM follows
     WHERE (follower_id = ? AND following_id = ?)
        OR (follower_id = ? AND following_id = ?)`,
  )
    .bind(viewerId, targetId, targetId, viewerId)
    .run();

  return c.json({ blocked: true });
}

export async function unblockUser(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = (c.req.param('userId') ?? '').trim();
  const viewerId = mochaUserIdKey(mochaUser);

  await c.env.DB.prepare(
    `DELETE FROM user_blocks
     WHERE LOWER(TRIM(blocker_id)) = ? AND LOWER(TRIM(blocked_id)) = ?`,
  )
    .bind(blockKey(viewerId), blockKey(targetId))
    .run();

  return c.json({ blocked: false });
}

export async function getMyBlockedAccounts(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const viewerId = mochaUserIdKey(mochaUser);
  const rows = await c.env.DB.prepare(
    `SELECT
       user_blocks.blocked_id,
       user_blocks.created_at,
       user_profiles.display_name,
       user_profiles.profile_image_url
     FROM user_blocks
     LEFT JOIN user_profiles ON LOWER(TRIM(user_profiles.mocha_user_id)) = LOWER(TRIM(user_blocks.blocked_id))
     WHERE LOWER(TRIM(user_blocks.blocker_id)) = ?
     ORDER BY user_blocks.created_at DESC`,
  )
    .bind(blockKey(viewerId))
    .all();

  return c.json({ blocked: rows.results ?? [] });
}

/** Viewer-facing block state for a profile page. */
export async function getBlockStatusForUser(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ blocked: false, blockedByThem: false });
  }

  return c.json(
    await getBlockDirections(c.env.DB, mochaUserIdKey(mochaUser), c.req.param('userId') ?? ''),
  );
}

export { isBlockedBetween };
