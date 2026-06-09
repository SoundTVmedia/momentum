import { Context } from 'hono';
import { getStaffProfile, isSuperAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';
import { suspendUser, unsuspendUser, isUserSuspended } from './user-ban-utils';
import { purgeUserAccount } from './user-purge-utils';
import { revokeAllEmailSessionsForUser } from './hybrid-auth';

type SuperAdminGate =
  | { ok: true; actorId: string }
  | { ok: false; response: Response };

async function requireSuperAdmin(c: Context): Promise<SuperAdminGate> {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isSuperAdmin(staffProfile)) {
    return { ok: false, response: c.json({ error: 'Superadmin access required' }, 403) };
  }

  return { ok: true, actorId: mochaUserIdKey(mochaUser) };
}

async function getTargetProfile(db: D1Database, targetUserId: string) {
  return (await db
    .prepare(
      'SELECT mocha_user_id, display_name, is_superadmin FROM user_profiles WHERE mocha_user_id = ?',
    )
    .bind(targetUserId)
    .first()) as {
    mocha_user_id: string;
    display_name: string | null;
    is_superadmin: number;
  } | null;
}

function assertCanModerateTarget(
  c: Context,
  actorId: string,
  targetUserId: string,
  targetProfile: { is_superadmin: number } | null,
): Response | null {
  if (!targetProfile) {
    return c.json({ error: 'User not found' }, 404);
  }
  if (actorId === targetUserId) {
    return c.json({ error: 'You cannot perform this action on your own account' }, 400);
  }
  if (targetProfile.is_superadmin === 1) {
    return c.json({ error: 'Cannot modify another superadmin account' }, 403);
  }
  return null;
}

async function revokeTargetSessions(db: D1Database, targetUserId: string): Promise<void> {
  await revokeAllEmailSessionsForUser(db, targetUserId);
  await db.prepare('DELETE FROM google_sessions WHERE user_id = ?').bind(targetUserId).run();
}

function requireUserIdParam(c: Context): string | Response {
  const userId = c.req.param('userId')?.trim();
  if (!userId) {
    return c.json({ error: 'User id is required' }, 400);
  }
  return userId;
}

export async function suspendUserAccount(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const targetUserId = requireUserIdParam(c);
  if (targetUserId instanceof Response) {
    return targetUserId;
  }
  const targetProfile = await getTargetProfile(c.env.DB, targetUserId);
  const blocked = assertCanModerateTarget(c, gate.actorId, targetUserId, targetProfile);
  if (blocked) {
    return blocked;
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    duration_days?: number | null;
    reason?: string | null;
  };

  await suspendUser(c.env.DB, targetUserId, gate.actorId, {
    durationDays: body.duration_days ?? null,
    reason: body.reason ?? null,
  });
  await revokeTargetSessions(c.env.DB, targetUserId);

  return c.json({ success: true, suspended: true });
}

export async function unsuspendUserAccount(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const targetUserId = requireUserIdParam(c);
  if (targetUserId instanceof Response) {
    return targetUserId;
  }

  const targetProfile = await getTargetProfile(c.env.DB, targetUserId);
  if (!targetProfile) {
    return c.json({ error: 'User not found' }, 404);
  }

  await unsuspendUser(c.env.DB, targetUserId);
  return c.json({ success: true, suspended: false });
}

export async function deleteUserAccount(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const targetUserId = requireUserIdParam(c);
  if (targetUserId instanceof Response) {
    return targetUserId;
  }

  const targetProfile = await getTargetProfile(c.env.DB, targetUserId);
  const blocked = assertCanModerateTarget(c, gate.actorId, targetUserId, targetProfile);
  if (blocked) {
    return blocked;
  }

  const body = (await c.req.json().catch(() => ({}))) as { delete_clips?: boolean };
  await purgeUserAccount(c.env.DB, targetUserId, { deleteClips: body.delete_clips !== false });

  return c.json({ success: true });
}

export async function searchClipsForModeration(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const q = (c.req.query('q') || '').trim();
  if (q.length < 1) {
    return c.json({ clips: [] });
  }

  const numericId = Number.parseInt(q, 10);
  let clips;

  if (!Number.isNaN(numericId)) {
    clips = await c.env.DB.prepare(
      `SELECT clips.id, clips.artist_name, clips.venue_name, clips.thumbnail_url,
              clips.mocha_user_id, clips.created_at, clips.is_hidden,
              user_profiles.display_name AS user_display_name
       FROM clips
       LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
       WHERE clips.id = ?
       LIMIT 20`,
    )
      .bind(numericId)
      .all();
  } else {
    const like = `%${q}%`;
    clips = await c.env.DB.prepare(
      `SELECT clips.id, clips.artist_name, clips.venue_name, clips.thumbnail_url,
              clips.mocha_user_id, clips.created_at, clips.is_hidden,
              user_profiles.display_name AS user_display_name
       FROM clips
       LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
       WHERE clips.artist_name LIKE ?
          OR clips.venue_name LIKE ?
          OR clips.mocha_user_id LIKE ?
          OR user_profiles.display_name LIKE ?
       ORDER BY clips.created_at DESC
       LIMIT 20`,
    )
      .bind(like, like, like, like)
      .all();
  }

  return c.json({ clips: clips.results || [] });
}

export async function listUsersByRole(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const role = (c.req.query('role') || '').trim();
  if (role !== 'ambassador' && role !== 'influencer') {
    return c.json({ error: 'Invalid role' }, 400);
  }

  const users = await c.env.DB.prepare(
    `SELECT mocha_user_id, display_name, profile_image_url, city, location, role,
            staff_flagged, staff_flag_reason,
            COALESCE(
              (SELECT 1 FROM user_bans
               WHERE user_bans.mocha_user_id = user_profiles.mocha_user_id
               AND (user_bans.expires_at IS NULL OR user_bans.expires_at > datetime('now'))
               LIMIT 1),
              0
            ) AS is_suspended
     FROM user_profiles
     WHERE role = ?
     ORDER BY display_name ASC
     LIMIT 200`,
  )
    .bind(role)
    .all();

  return c.json({ users: users.results || [], role });
}

export async function getUserModerationStatus(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const targetUserId = requireUserIdParam(c);
  if (targetUserId instanceof Response) {
    return targetUserId;
  }

  const profile = (await c.env.DB.prepare(
    `SELECT mocha_user_id, display_name, role, is_superadmin, staff_flagged, staff_flag_reason
     FROM user_profiles WHERE mocha_user_id = ?`,
  )
    .bind(targetUserId)
    .first()) as {
    mocha_user_id: string;
    display_name: string | null;
    role: string;
    is_superadmin: number;
    staff_flagged: number;
    staff_flag_reason: string | null;
  } | null;

  if (!profile) {
    return c.json({ error: 'User not found' }, 404);
  }

  const suspended = await isUserSuspended(c.env.DB, targetUserId);

  return c.json({
    ...profile,
    is_suspended: suspended ? 1 : 0,
  });
}

export async function flagUserAccount(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const targetUserId = requireUserIdParam(c);
  if (targetUserId instanceof Response) {
    return targetUserId;
  }

  const targetProfile = await getTargetProfile(c.env.DB, targetUserId);
  const blocked = assertCanModerateTarget(c, gate.actorId, targetUserId, targetProfile);
  if (blocked) {
    return blocked;
  }

  const body = (await c.req.json()) as { reason?: string };
  const reason = body.reason?.trim();
  if (!reason) {
    return c.json({ error: 'Flag reason is required' }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE user_profiles
     SET staff_flagged = 1, staff_flag_reason = ?, staff_flagged_by = ?,
         staff_flagged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE mocha_user_id = ?`,
  )
    .bind(reason, gate.actorId, targetUserId)
    .run();

  return c.json({ success: true, staff_flagged: true, staff_flag_reason: reason });
}

export async function unflagUserAccount(c: Context) {
  const gate = await requireSuperAdmin(c);
  if (!gate.ok) {
    return gate.response;
  }

  const targetUserId = requireUserIdParam(c);
  if (targetUserId instanceof Response) {
    return targetUserId;
  }

  const targetProfile = await getTargetProfile(c.env.DB, targetUserId);
  if (!targetProfile) {
    return c.json({ error: 'User not found' }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE user_profiles
     SET staff_flagged = 0, staff_flag_reason = NULL, staff_flagged_by = NULL,
         staff_flagged_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE mocha_user_id = ?`,
  )
    .bind(targetUserId)
    .run();

  return c.json({ success: true, staff_flagged: false });
}
