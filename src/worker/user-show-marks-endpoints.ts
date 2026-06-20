import type { Context } from 'hono';
import { mochaUserIdKey, normalizeArtistDisplayName } from './favorite-artists-sync';
import { isUserFollowTargetId } from './follow-endpoints';
import {
  isActiveShowMarkForCapture,
  isUpcomingJamBaseEvent,
  mergeJamBaseEventWithShowMark,
  showMarkShouldPromoteGoingToAttended,
  showMarkToJamBaseEvent,
  type ShowMarkStatus,
  type ShowMarkUpsertInput,
  type UserShowMark,
} from '../shared/show-marks';
import {
  jamBaseEventHasStarted,
  jamBaseEventHoursFromStart,
  jamBaseEventInProgress,
  jamBaseEventUpcomingOrInProgress,
  JAMBASE_EVENT_ONGOING_HOURS_AFTER_START,
} from '../shared/jambase-event-day';
import {
  jamBaseApiKeyConfigured,
  jamBaseQuotaFromEnv,
  normalizeJamBaseApiKey,
} from './jambase-client';
import { jamBaseEventImageUrl } from '../shared/jambase-events';
import { fetchJamBaseEventById, fetchJamBaseEventsByArtistName } from './jambase-endpoints';

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

export async function loadGoingShowMarksForUser(
  db: D1Database,
  mochaUserId: string,
): Promise<UserShowMark[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM user_show_marks
       WHERE mocha_user_id = ? AND status = 'going'
       ORDER BY
         CASE WHEN start_date IS NULL OR start_date = '' THEN 1 ELSE 0 END,
         start_date ASC`,
    )
    .bind(mochaUserId)
    .all();

  return ((rows.results ?? []) as Record<string, unknown>[]).map(rowToMark);
}

/** Persist Going → Went for shows whose doors time has passed. */
export async function promoteStartedGoingMarksForUser(
  db: D1Database,
  mochaUserId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const rows = await db
    .prepare(
      `SELECT * FROM user_show_marks WHERE mocha_user_id = ? AND status = 'going'`,
    )
    .bind(mochaUserId)
    .all();

  for (const row of rows.results ?? []) {
    const mark = rowToMark(row as Record<string, unknown>);
    if (!showMarkShouldPromoteGoingToAttended(mark, nowMs)) continue;
    await db
      .prepare(
        `UPDATE user_show_marks
         SET status = 'attended', updated_at = datetime('now')
         WHERE mocha_user_id = ? AND jambase_event_id = ?`,
      )
      .bind(mochaUserId, mark.jambase_event_id)
      .run();
  }
}

/** Going marks still eligible for capture / venue matching (includes in-progress Went). */
export async function loadCaptureShowMarksForUser(
  db: D1Database,
  mochaUserId: string,
  nowMs: number = Date.now(),
): Promise<UserShowMark[]> {
  await promoteStartedGoingMarksForUser(db, mochaUserId, nowMs);

  const rows = await db
    .prepare(
      `SELECT * FROM user_show_marks
       WHERE mocha_user_id = ? AND status IN ('going', 'attended')`,
    )
    .bind(mochaUserId)
    .all();

  return ((rows.results ?? []) as Record<string, unknown>[])
    .map(rowToMark)
    .filter((mark) => isActiveShowMarkForCapture(mark, nowMs));
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

export function rowToMark(row: Record<string, unknown>): UserShowMark {
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
    venue_timezone: typeof row.venue_timezone === 'string' ? row.venue_timezone : null,
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
    venue_timezone: str('venue_timezone'),
    start_date: str('start_date'),
  };
}

function tempMarkFromInput(input: ShowMarkUpsertInput): UserShowMark {
  return {
    id: 0,
    status: input.status,
    jambase_event_id: input.jambase_event_id,
    jambase_venue_id: input.jambase_venue_id ?? null,
    jambase_artist_id: input.jambase_artist_id ?? null,
    event_title: input.event_title ?? null,
    artist_name: input.artist_name ?? null,
    venue_name: input.venue_name ?? null,
    venue_location: input.venue_location ?? null,
    venue_timezone: input.venue_timezone ?? null,
    start_date: input.start_date ?? null,
    created_at: '',
    updated_at: '',
  };
}

function goingMarkAllowed(input: ShowMarkUpsertInput): boolean {
  const ev = showMarkToJamBaseEvent(tempMarkFromInput(input));
  if (jamBaseEventUpcomingOrInProgress(ev)) return true;
  if (jamBaseEventInProgress(ev)) return true;
  const hours = jamBaseEventHoursFromStart(ev, Date.now());
  return (
    hours != null &&
    hours >= 0 &&
    hours <= JAMBASE_EVENT_ONGOING_HOURS_AFTER_START
  );
}

async function enrichMarkWithJamBaseEvent(
  key: string,
  jbQ: ReturnType<typeof jamBaseQuotaFromEnv>,
  mark: UserShowMark,
  artistEventsCache: Map<string, Record<string, unknown>[]>,
): Promise<Record<string, unknown>> {
  const eventId = mark.jambase_event_id.trim();

  let jb: Record<string, unknown> | null = null;
  if (eventId.startsWith('jambase:')) {
    jb = await fetchJamBaseEventById(key, jbQ, eventId);
  }

  let merged = mergeJamBaseEventWithShowMark(mark, jb);

  if (!jamBaseEventImageUrl(merged) && eventId) {
    const artist = mark.artist_name?.trim();
    if (artist) {
      let list = artistEventsCache.get(artist);
      if (!list) {
        const { events } = await fetchJamBaseEventsByArtistName(key, jbQ, artist, '40');
        list = events;
        artistEventsCache.set(artist, list);
      }
      const match = list.find(
        (ev) => typeof ev.identifier === 'string' && ev.identifier.trim() === eventId,
      );
      if (match) {
        merged = mergeJamBaseEventWithShowMark(mark, match);
      }
    }
  }

  return merged;
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
  const artistEventsCache = new Map<string, Record<string, unknown>[]>();
  return Promise.all(
    slice.map((mark) => enrichMarkWithJamBaseEvent(key, jbQ, mark, artistEventsCache)),
  );
}

/** GET /api/users/me/show-marks?status=going|attended&enrich=jambase */
export async function getMyShowMarks(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  const uid = mochaUserIdKey(mochaUser);
  const statusFilter = c.req.query('status');
  const validStatus = statusFilter === 'going' || statusFilter === 'attended';

  try {
    await promoteStartedGoingMarksForUser(c.env.DB, uid);

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

  const upcoming = isUpcomingJamBaseEvent(showMarkToJamBaseEvent(tempMarkFromInput(input)));
  const markEvent = showMarkToJamBaseEvent(tempMarkFromInput(input));
  if (input.status === 'going' && !goingMarkAllowed(input)) {
    return c.json(
      { error: 'Going is only for upcoming shows. Mark past shows as Went instead.' },
      400,
    );
  }
  if (
    input.status === 'attended' &&
    upcoming &&
    !jamBaseEventHasStarted(markEvent)
  ) {
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
         event_title, artist_name, venue_name, venue_location, venue_timezone, start_date, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(mocha_user_id, jambase_event_id) DO UPDATE SET
         status = excluded.status,
         jambase_venue_id = COALESCE(excluded.jambase_venue_id, user_show_marks.jambase_venue_id),
         jambase_artist_id = COALESCE(excluded.jambase_artist_id, user_show_marks.jambase_artist_id),
         event_title = COALESCE(excluded.event_title, user_show_marks.event_title),
         artist_name = COALESCE(excluded.artist_name, user_show_marks.artist_name),
         venue_name = COALESCE(excluded.venue_name, user_show_marks.venue_name),
         venue_location = COALESCE(excluded.venue_location, user_show_marks.venue_location),
         venue_timezone = COALESCE(excluded.venue_timezone, user_show_marks.venue_timezone),
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
        input.venue_timezone ?? null,
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
      if (showMarkShouldPromoteGoingToAttended(mark)) continue;
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

    const allMarks = [...byUser.values()].flatMap((g) => g.marks);
    const enriched = await enrichMarksWithJamBaseEvents(c, allMarks);
    const eventsByEventId: Record<string, Record<string, unknown>> = {};
    allMarks.forEach((mark, i) => {
      eventsByEventId[mark.jambase_event_id] = enriched[i] ?? showMarkToJamBaseEvent(mark);
    });

    return c.json({ friends: [...byUser.values()], eventsByEventId });
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
