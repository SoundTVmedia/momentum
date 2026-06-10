import type { Context } from 'hono';
import { mochaUserIdKey, normalizeArtistDisplayName } from './favorite-artists-sync';
import { isUserFollowTargetId } from './follow-endpoints';
import {
  isUpcomingShowMarkStartDate,
  mergeJamBaseEventWithShowMark,
  showMarkToJamBaseEvent,
  type ShowMarkStatus,
  type ShowMarkUpsertInput,
  type UserShowMark,
} from '../shared/show-marks';
import {
  jamBaseApiKeyConfigured,
  jamBaseQuotaFromEnv,
  normalizeJamBaseApiKey,
} from './jambase-client';
import { fetchJamBaseEventById } from './jambase-endpoints';

/** Going marks that are tonight or later (SQLite date compare on YYYY-MM-DD prefix). */
export const UPCOMING_SHOW_MARK_SQL = `(
  start_date IS NULL OR start_date = ''
  OR substr(start_date, 1, 10) >= date('now', '-1 day')
)`;

export async function loadAttendedArtistNames(
  db: D1Database,
  mochaUserId: string,
  limit = 30,
): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT artist_name, COUNT(*) AS c
       FROM user_show_marks
       WHERE mocha_user_id = ? AND status = 'attended' AND artist_name IS NOT NULL AND trim(artist_name) != ''
       GROUP BY lower(trim(artist_name))
       ORDER BY c DESC, MAX(updated_at) DESC
       LIMIT ?`,
    )
    .bind(mochaUserId, limit)
    .all();

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows.results ?? []) {
    const name = normalizeArtistDisplayName(
      String((row as { artist_name?: unknown }).artist_name ?? ''),
    );
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function loadGoingEventIds(db: D1Database, mochaUserId: string): Promise<Set<string>> {
  const rows = await db
    .prepare(
      `SELECT jambase_event_id FROM user_show_marks
       WHERE mocha_user_id = ? AND status = 'going' AND ${UPCOMING_SHOW_MARK_SQL}`,
    )
    .bind(mochaUserId)
    .all();

  const ids = new Set<string>();
  for (const row of rows.results ?? []) {
    const id = String((row as { jambase_event_id?: unknown }).jambase_event_id ?? '').trim();
    if (id) ids.add(id);
  }
  return ids;
}

function rowToMark(row: Record<string, unknown>): UserShowMark {
  return {
    id: Number(row.id),
    status: row.status as ShowMarkStatus,
    jambase_event_id: String(row.jambase_event_id),
    jambase_venue_id:
      typeof row.jambase_venue_id === 'string' ? row.jambase_venue_id : null,
    jambase_artist_id:
      typeof row.jambase_artist_id === 'string' ? row.jambase_artist_id : null,
    event_title: typeof row.event_title === 'string' ? row.event_title : null,
    artist_name: typeof row.artist_name === 'string' ? row.artist_name : null,
    venue_name: typeof row.venue_name === 'string' ? row.venue_name : null,
    venue_location: typeof row.venue_location === 'string' ? row.venue_location : null,
    start_date: typeof row.start_date === 'string' ? row.start_date : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function parseUpsertBody(body: Record<string, unknown>): ShowMarkUpsertInput | null {
  const status = body.status;
  if (status !== 'going' && status !== 'attended') return null;
  const eventId =
    typeof body.jambase_event_id === 'string' ? body.jambase_event_id.trim() : '';
  if (!eventId) return null;

  const str = (k: string) => {
    const v = body[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  return {
    status,
    jambase_event_id: eventId,
    jambase_venue_id: str('jambase_venue_id'),
    jambase_artist_id: str('jambase_artist_id'),
    event_title: str('event_title'),
    artist_name: str('artist_name'),
    venue_name: str('venue_name'),
    venue_location: str('venue_location'),
    start_date: str('start_date'),
  };
}

async function enrichMarksWithJamBaseEvents(
  c: Context,
  marks: UserShowMark[],
): Promise<Record<string, unknown>[]> {
  const key = normalizeJamBaseApiKey(c.env.JAMBASE_API_KEY);
  if (!key || marks.length === 0) {
    return marks.map(showMarkToJamBaseEvent);
  }
  const jbQ = jamBaseQuotaFromEnv(c.env);
  const cap = Math.min(marks.length, 24);
  const slice = marks.slice(0, cap);
  const events = await Promise.all(
    slice.map(async (mark) => {
      const eventId = mark.jambase_event_id.trim();
      const jb =
        eventId.startsWith('jambase:')
          ? await fetchJamBaseEventById(key, jbQ, eventId)
          : null;
      return mergeJamBaseEventWithShowMark(mark, jb);
    }),
  );
  return events;
}

/** GET /api/users/me/show-marks?status=going|attended&enrich=jambase */
export async function getMyShowMarks(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  const uid = mochaUserIdKey(mochaUser);
  const statusFilter = c.req.query('status');
  const validStatus = statusFilter === 'going' || statusFilter === 'attended';

  try {
    const rows = validStatus
      ? await c.env.DB.prepare(
          `SELECT * FROM user_show_marks
           WHERE mocha_user_id = ? AND status = ?
           ORDER BY
             CASE WHEN start_date IS NULL OR start_date = '' THEN 1 ELSE 0 END,
             start_date ASC`,
        )
          .bind(uid, statusFilter)
          .all()
      : await c.env.DB.prepare(
          `SELECT * FROM user_show_marks
           WHERE mocha_user_id = ?
           ORDER BY status ASC,
             CASE WHEN start_date IS NULL OR start_date = '' THEN 1 ELSE 0 END,
             start_date DESC`,
        )
          .bind(uid)
          .all();

    const marks = ((rows.results ?? []) as Record<string, unknown>[]).map(rowToMark);
    const enrich = c.req.query('enrich') === 'jambase';
    const events =
      enrich && jamBaseApiKeyConfigured(c.env.JAMBASE_API_KEY)
        ? await enrichMarksWithJamBaseEvents(c, marks)
        : undefined;
    return c.json({
      marks,
      ...(events ? { events } : {}),
    });
  } catch (e) {
    console.error('getMyShowMarks', e);
    return c.json({ error: 'Failed to load show marks' }, 500);
  }
}

/** POST /api/users/me/show-marks — upsert going / attended */
export async function upsertMyShowMark(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const input = parseUpsertBody(body);
  if (!input) {
    return c.json({ error: 'status and jambase_event_id are required' }, 400);
  }

  const upcoming = isUpcomingShowMarkStartDate(input.start_date);
  if (input.status === 'going' && !upcoming) {
    return c.json(
      { error: 'Going is only for upcoming shows. Mark past shows as Went instead.' },
      400,
    );
  }
  if (input.status === 'attended' && upcoming) {
    return c.json(
      { error: 'Went is only for past shows. Mark upcoming shows as Going instead.' },
      400,
    );
  }

  const uid = mochaUserIdKey(mochaUser);

  try {
    await c.env.DB.prepare(
      `INSERT INTO user_show_marks (
         mocha_user_id, status, jambase_event_id, jambase_venue_id, jambase_artist_id,
         event_title, artist_name, venue_name, venue_location, start_date, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(mocha_user_id, jambase_event_id) DO UPDATE SET
         status = excluded.status,
         jambase_venue_id = COALESCE(excluded.jambase_venue_id, user_show_marks.jambase_venue_id),
         jambase_artist_id = COALESCE(excluded.jambase_artist_id, user_show_marks.jambase_artist_id),
         event_title = COALESCE(excluded.event_title, user_show_marks.event_title),
         artist_name = COALESCE(excluded.artist_name, user_show_marks.artist_name),
         venue_name = COALESCE(excluded.venue_name, user_show_marks.venue_name),
         venue_location = COALESCE(excluded.venue_location, user_show_marks.venue_location),
         start_date = COALESCE(excluded.start_date, user_show_marks.start_date),
         updated_at = datetime('now')`,
    )
      .bind(
        uid,
        input.status,
        input.jambase_event_id,
        input.jambase_venue_id ?? null,
        input.jambase_artist_id ?? null,
        input.event_title ?? null,
        input.artist_name ?? null,
        input.venue_name ?? null,
        input.venue_location ?? null,
        input.start_date ?? null,
      )
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM user_show_marks WHERE mocha_user_id = ? AND jambase_event_id = ?`,
    )
      .bind(uid, input.jambase_event_id)
      .first();

    if (!row) return c.json({ error: 'Failed to save show mark' }, 500);
    return c.json({ mark: rowToMark(row as Record<string, unknown>) });
  } catch (e) {
    console.error('upsertMyShowMark', e);
    return c.json({ error: 'Failed to save show mark' }, 500);
  }
}

/** GET /api/shows/friends-going — going marks from people you follow */
export async function getFriendsGoingShows(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  const uid = mochaUserIdKey(mochaUser);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '40', 10), 1), 80);

  try {
    const rows = await c.env.DB.prepare(
      `SELECT
         m.*,
         up.display_name,
         up.profile_image_url
       FROM follows f
       INNER JOIN user_show_marks m
         ON m.mocha_user_id = f.following_id AND m.status = 'going'
       LEFT JOIN user_profiles up ON up.mocha_user_id = f.following_id
       WHERE f.follower_id = ?
         AND ${UPCOMING_SHOW_MARK_SQL}
       ORDER BY
         CASE WHEN m.start_date IS NULL OR m.start_date = '' THEN 1 ELSE 0 END,
         m.start_date ASC
       LIMIT ?`,
    )
      .bind(uid, limit)
      .all();

    type FriendGroup = {
      mocha_user_id: string;
      display_name: string | null;
      profile_image_url: string | null;
      marks: UserShowMark[];
    };

    const byUser = new Map<string, FriendGroup>();
    for (const raw of rows.results ?? []) {
      const row = raw as Record<string, unknown>;
      const friendId = String(row.mocha_user_id ?? '').trim();
      if (!friendId || !isUserFollowTargetId(friendId)) continue;

      const mark = rowToMark(row);
      let group = byUser.get(friendId);
      if (!group) {
        group = {
          mocha_user_id: friendId,
          display_name:
            typeof row.display_name === 'string' ? row.display_name : null,
          profile_image_url:
            typeof row.profile_image_url === 'string' ? row.profile_image_url : null,
          marks: [],
        };
        byUser.set(friendId, group);
      }
      group.marks.push(mark);
    }

    return c.json({ friends: [...byUser.values()] });
  } catch (e) {
    console.error('getFriendsGoingShows', e);
    return c.json({ error: 'Failed to load friends show plans' }, 500);
  }
}

/** DELETE /api/users/me/show-marks/:jambaseEventId */
export async function deleteMyShowMark(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  const eventId = decodeURIComponent(c.req.param('jambaseEventId') ?? '').trim();
  if (!eventId) return c.json({ error: 'jambase_event_id required' }, 400);

  const uid = mochaUserIdKey(mochaUser);

  try {
    await c.env.DB.prepare(
      `DELETE FROM user_show_marks WHERE mocha_user_id = ? AND jambase_event_id = ?`,
    )
      .bind(uid, eventId)
      .run();
    return c.json({ removed: true });
  } catch (e) {
    console.error('deleteMyShowMark', e);
    return c.json({ error: 'Failed to remove show mark' }, 500);
  }
}
