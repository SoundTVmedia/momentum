import { Context } from 'hono';
import { isCommunityRole } from '../shared/user-roles';
import { getStaffProfile, isAdmin, isSuperAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';

export async function searchUsersForRoleAdmin(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isAdmin(staffProfile)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const q = (c.req.query('q') || '').trim();
  if (q.length < 2) {
    return c.json({ users: [] });
  }

  const users = await c.env.DB.prepare(
    `SELECT mocha_user_id, display_name, role, is_admin, is_moderator, is_superadmin, profile_image_url,
            COALESCE(
              (SELECT 1 FROM user_bans
               WHERE user_bans.mocha_user_id = user_profiles.mocha_user_id
               AND (user_bans.expires_at IS NULL OR user_bans.expires_at > datetime('now'))
               LIMIT 1),
              0
            ) AS is_suspended
     FROM user_profiles
     WHERE display_name LIKE ? OR mocha_user_id LIKE ?
     ORDER BY display_name ASC
     LIMIT 20`,
  )
    .bind(`%${q}%`, `%${q}%`)
    .all();

  return c.json({ users: users.results || [] });
}

export async function updateUserRole(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isAdmin(staffProfile)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const targetUserId = c.req.param('userId');
  const body = (await c.req.json()) as {
    role?: string;
    is_admin?: boolean;
    is_moderator?: boolean;
    is_superadmin?: boolean;
  };

  const targetProfile = (await c.env.DB.prepare(
    'SELECT role, is_admin, is_moderator, is_superadmin FROM user_profiles WHERE mocha_user_id = ?',
  )
    .bind(targetUserId)
    .first()) as {
    role: string;
    is_admin: number;
    is_moderator: number;
    is_superadmin: number;
  } | null;

  if (!targetProfile) {
    return c.json({ error: 'User not found' }, 404);
  }

  const superAdmin = isSuperAdmin(staffProfile);

  if (!superAdmin && targetProfile.is_superadmin) {
    return c.json({ error: 'Cannot modify superadmin accounts' }, 403);
  }

  let newRole = targetProfile.role;
  if (body.role !== undefined) {
    if (!isCommunityRole(body.role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }
    newRole = body.role;
  }

  let newIsAdmin = targetProfile.is_admin;
  let newIsModerator = targetProfile.is_moderator;
  let newIsSuperAdmin = targetProfile.is_superadmin ?? 0;

  const changingStaffFlags =
    body.is_admin !== undefined ||
    body.is_moderator !== undefined ||
    body.is_superadmin !== undefined;

  if (changingStaffFlags) {
    if (!superAdmin) {
      return c.json({ error: 'Superadmin access required to change admin permissions' }, 403);
    }
    if (body.is_admin !== undefined) {
      newIsAdmin = body.is_admin ? 1 : 0;
    }
    if (body.is_moderator !== undefined) {
      newIsModerator = body.is_moderator ? 1 : 0;
    }
    if (body.is_superadmin !== undefined) {
      newIsSuperAdmin = body.is_superadmin ? 1 : 0;
    }
  }

  await c.env.DB.prepare(
    `UPDATE user_profiles
     SET role = ?, is_admin = ?, is_moderator = ?, is_superadmin = ?, updated_at = CURRENT_TIMESTAMP
     WHERE mocha_user_id = ?`,
  )
    .bind(newRole, newIsAdmin, newIsModerator, newIsSuperAdmin, targetUserId)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM user_profiles WHERE mocha_user_id = ?')
    .bind(targetUserId)
    .first();

  return c.json(updated);
}
