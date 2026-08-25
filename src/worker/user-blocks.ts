import type { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';

/** `mocha_user_id` is written with mixed case across providers; compare on a lowered key. */
export function blockKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Ids the viewer must not see: everyone they blocked plus everyone who blocked them.
 * Blocking is symmetric for visibility even though the row itself has a direction.
 */
export async function getHiddenUserIdsForViewer(
  db: D1Database,
  viewerId: string,
): Promise<Set<string>> {
  const key = blockKey(viewerId);
  if (!key) return new Set();

  const rows = await db
    .prepare(
      `SELECT blocker_id, blocked_id FROM user_blocks
       WHERE LOWER(TRIM(blocker_id)) = ? OR LOWER(TRIM(blocked_id)) = ?`,
    )
    .bind(key, key)
    .all();

  const hidden = new Set<string>();
  for (const row of (rows.results ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
    const blocker = blockKey(row.blocker_id);
    const blocked = blockKey(row.blocked_id);
    hidden.add(blocker === key ? blocked : blocker);
  }
  hidden.delete(key);
  return hidden;
}

/** Hidden ids for the signed-in viewer, or an empty set for anonymous requests. */
export async function getHiddenUserIdsForRequest(
  c: Context<{ Bindings: Env }>,
): Promise<Set<string>> {
  const user = c.get('user');
  if (!user) return new Set();
  return getHiddenUserIdsForViewer(c.env.DB, mochaUserIdKey(user));
}

/** Drop rows authored by a blocked account. Applied after the query so feed SQL stays untouched. */
export function withoutBlockedAuthors<T extends Record<string, unknown>>(
  rows: T[],
  hidden: Set<string>,
  authorField: keyof T = 'mocha_user_id' as keyof T,
): T[] {
  if (hidden.size === 0) return rows;
  return rows.filter((row) => !hidden.has(blockKey(row[authorField])));
}

/** Viewer-facing block state for a profile page. */
export async function getBlockDirections(
  db: D1Database,
  viewerId: string,
  targetId: string,
): Promise<{ blocked: boolean; blockedByThem: boolean }> {
  const viewer = blockKey(viewerId);
  const target = blockKey(targetId);
  if (!viewer || !target || viewer === target) {
    return { blocked: false, blockedByThem: false };
  }

  const row = await db
    .prepare(
      `SELECT blocker_id FROM user_blocks
       WHERE (LOWER(TRIM(blocker_id)) = ? AND LOWER(TRIM(blocked_id)) = ?)
          OR (LOWER(TRIM(blocker_id)) = ? AND LOWER(TRIM(blocked_id)) = ?)`,
    )
    .bind(viewer, target, target, viewer)
    .all();

  const rows = (row.results ?? []) as Array<{ blocker_id: string }>;
  return {
    blocked: rows.some((r) => blockKey(r.blocker_id) === viewer),
    blockedByThem: rows.some((r) => blockKey(r.blocker_id) === target),
  };
}

export async function isBlockedBetween(
  db: D1Database,
  a: string,
  b: string,
): Promise<boolean> {
  const left = blockKey(a);
  const right = blockKey(b);
  if (!left || !right || left === right) return false;

  const row = await db
    .prepare(
      `SELECT 1 AS blocked FROM user_blocks
       WHERE (LOWER(TRIM(blocker_id)) = ? AND LOWER(TRIM(blocked_id)) = ?)
          OR (LOWER(TRIM(blocker_id)) = ? AND LOWER(TRIM(blocked_id)) = ?)
       LIMIT 1`,
    )
    .bind(left, right, right, left)
    .first();

  return Boolean(row);
}
