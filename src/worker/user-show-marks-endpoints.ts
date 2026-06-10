import type { Context } from 'hono';
import { mochaUserIdKey } from './favorite-artists-sync';
import type { ShowMarkStatus, ShowMarkUpsertInput, UserShowMark } from '../shared/show-marks';

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

/** GET /api/users/me/show-marks?status=going|attended */
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
    return c.json({ marks });
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
