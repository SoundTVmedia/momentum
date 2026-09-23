import type { Context } from 'hono';
import { mochaUserIdKey, normalizeArtistDisplayName } from './favorite-artists-sync';
import { isUserFollowTargetId } from './follow-endpoints';
import {
  isActiveShowMarkForCapture,
  isProfilePastShowMark,
  isUpcomingJamBaseEvent,
  mergeJamBaseEventWithShowMark,
  showMarkShouldPromoteGoingToAttended,
  showMarkToJamBaseEvent,
  userShowMarkToPastShowSummary,
  type ShowMarkStatus,
  type ShowMarkUpsertInput,
  type UserShowMark,
} from '../shared/show-marks';
import { PUBLIC_VISIBLE_CLIP_SQL } from '../shared/content-feed';
import { festivalClipTitleNeedles } from '../shared/jambase-festival';
import { getBlockDirections } from './user-blocks';
import { attachPastShowArtistImages } from './past-show-list';
import {
  clipEventTitleLooseSql,
  collapsePastShowRows,
  concertNameKey,
  pastShowsAreSameConcert,
  showPageIdForPastShowCard,
  type PastShowListRow,
} from './past-show-sql';
import {
  jamBaseEventHasStarted,
  jamBaseEventImThereEligible,
  jamBaseEventUpcomingOrInProgress,
} from '../shared/jambase-event-day';
import {
  jamBaseApiKeyConfigured,
  jamBaseQuotaFromEnv,
  normalizeJamBaseApiKey,
} from './jambase-client';
import { jamBaseEventImageUrl } from '../shared/jambase-events';
import { fetchJamBaseEventById, fetchJamBaseEventsByArtistName } from './jambase-endpoints';
import { isArchivalShowId } from '../shared/archival-show';

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
  return jamBaseEventImThereEligible(ev);
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

function pastShowCardToListRow(card: ReturnType<typeof userShowMarkToPastShowSummary>): PastShowListRow {
  return {
    show_id: card.show_id,
    event_title: card.event_title,
    artist_name: card.artist_name || null,
    show_date: card.show_date || null,
    venue_name: card.venue_name,
    venue_location: card.venue_location,
    jambase_event_id: card.jambase_event_id,
    jambase_venue_id: card.jambase_venue_id,
    jambase_artist_id: card.jambase_artist_id,
    clip_count: card.clip_count,
    thumbnail_url: card.thumbnail_url,
    artist_image_url: card.artist_image_url,
  };
}

function clipToPastShowRow(row: {
  jambase_event_id?: unknown;
  show_id?: unknown;
  event_title?: unknown;
  artist_name?: unknown;
  venue_name?: unknown;
  timestamp?: unknown;
  thumbnail_url?: unknown;
}): PastShowListRow {
  const text = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    show_id: text(row.show_id),
    event_title: text(row.event_title),
    artist_name: text(row.artist_name),
    show_date: text(row.timestamp),
    venue_name: text(row.venue_name),
    venue_location: null,
    jambase_event_id: text(row.jambase_event_id),
    jambase_venue_id: null,
    jambase_artist_id: null,
    clip_count: 1,
    thumbnail_url: text(row.thumbnail_url),
  };
}

async function attachClipStatsToPastShows(
  db: D1Database,
  rows: PastShowListRow[],
): Promise<PastShowListRow[]> {
  const ids = [
    ...new Set(
      rows.flatMap((row) =>
        [row.jambase_event_id, row.show_id, ...(row.identity_ids ?? [])]
          .map((id) => (id ?? '').trim())
          .filter((id) => id.length > 0),
      ),
    ),
  ];
  const titles = [
    ...new Set(
      rows
        .map((row) => concertNameKey(row.event_title))
        .filter((title) => title.length >= 4),
    ),
  ];
  const festivalNeedles = [
    ...new Set(rows.flatMap((row) => festivalClipTitleNeedles(row.event_title))),
  ];
  if (ids.length === 0 && titles.length === 0 && festivalNeedles.length === 0) return rows;

  const idPlaceholders = ids.map(() => '?').join(',');
  const titleSql =
    titles.length > 0
      ? titles
          .map(
            () =>
              `LOWER(REPLACE(REPLACE(TRIM(IFNULL(clips.event_title, '')), '-', ' '), '''', '')) LIKE ?`,
          )
          .join(' OR ')
      : '';
  const idSql =
    ids.length > 0
      ? `TRIM(IFNULL(clips.jambase_event_id, '')) IN (${idPlaceholders})
         OR TRIM(IFNULL(clips.show_id, '')) IN (${idPlaceholders})`
      : '';
  const looseTitle = clipEventTitleLooseSql('clips');
  const festivalSql =
    festivalNeedles.length > 0
      ? festivalNeedles
          .map(() => `instr(' ' || ${looseTitle} || ' ', ' ' || ? || ' ') > 0`)
          .join(' OR ')
      : '';
  const identityWhere = [idSql, titleSql].filter(Boolean).join(' OR ');

  const loadClips = async (where: string, binds: unknown[]) => {
    const result = await db
      .prepare(
        `SELECT clips.jambase_event_id, clips.show_id, clips.event_title, clips.artist_name,
                clips.venue_name, clips.timestamp, clips.thumbnail_url
         FROM clips
         WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
           AND (${where})
         LIMIT 500`,
      )
      .bind(...binds)
      .all();
    return ((result.results ?? []) as Array<Record<string, unknown>>).map(clipToPastShowRow);
  };

  try {
    const loaded: PastShowListRow[] = [];
    if (identityWhere) {
      loaded.push(...(await loadClips(identityWhere, [...ids, ...ids, ...titles.map((title) => `%${title}%`)])));
    }
    if (festivalSql) {
      loaded.push(...(await loadClips(festivalSql, festivalNeedles)));
    }
    const seen = new Set<string>();
    const clips = loaded.filter((clip) => {
      const key = [
        clip.jambase_event_id,
        clip.show_id,
        clip.event_title,
        clip.artist_name,
        clip.show_date,
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return rows.map((row) => {
      const matched = clips.filter((clip) => pastShowsAreSameConcert(row, clip));
      if (matched.length === 0) return { ...row, clip_count: 0 };
      const thumbnail =
        row.thumbnail_url ||
        matched.find((clip) => clip.thumbnail_url?.trim())?.thumbnail_url ||
        null;
      const link = showPageIdForPastShowCard(row, matched);
      return {
        ...row,
        clip_count: matched.length,
        thumbnail_url: thumbnail,
        show_id: link?.showId || row.show_id,
        link_artist_name: link?.artistName || row.artist_name,
      };
    });
  } catch (e) {
    console.error('attachClipStatsToPastShows', e);
    return rows;
  }
}

function pastShowListRowToCard(row: PastShowListRow) {
  return {
    show_id: row.show_id,
    event_title: row.event_title?.trim() || 'Show',
    artist_name: row.artist_name?.trim() || '',
    show_date: row.show_date?.trim() || '',
    venue_name: row.venue_name,
    venue_location: row.venue_location,
    jambase_event_id: row.jambase_event_id,
    jambase_venue_id: row.jambase_venue_id,
    jambase_artist_id: row.jambase_artist_id,
    clip_count: row.clip_count ?? 0,
    thumbnail_url: row.thumbnail_url,
    artist_image_url: row.artist_image_url ?? null,
    link_artist_name: row.link_artist_name ?? null,
  };
}

/**
 * When a show URL is an attended-mark id that no clip stored, return the clip's
 * show id so the page can open the same show the player title uses.
 */
export async function clipShowIdForAttendedMark(
  db: D1Database,
  showId: string,
): Promise<string | null> {
  const id = showId.trim();
  if (!id) return null;
  const mark = await db
    .prepare(
      `SELECT event_title, artist_name, venue_name, start_date, jambase_event_id
       FROM user_show_marks
       WHERE jambase_event_id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first();
  if (!mark) return null;
  const raw = mark as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const card: PastShowListRow = {
    show_id: id,
    event_title: text(raw.event_title),
    artist_name: text(raw.artist_name),
    show_date: text(raw.start_date),
    venue_name: text(raw.venue_name),
    venue_location: null,
    jambase_event_id: id,
    jambase_venue_id: null,
    jambase_artist_id: null,
    clip_count: 0,
    thumbnail_url: null,
  };
  const venueKey = concertNameKey(card.venue_name);
  const titleKey = concertNameKey(card.event_title);
  const artistKey = concertNameKey(card.artist_name);
  if (venueKey.length < 4 && titleKey.length < 4 && artistKey.length < 4) return null;
  try {
    const result = await db
      .prepare(
        `SELECT clips.jambase_event_id, clips.show_id, clips.event_title, clips.artist_name,
                clips.venue_name, clips.timestamp
         FROM clips
         WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
           AND (
             (? != '' AND instr(LOWER(REPLACE(REPLACE(IFNULL(clips.venue_name, ''), '-', ' '), '''', '')), ?) > 0)
             OR (? != '' AND instr(LOWER(REPLACE(REPLACE(IFNULL(clips.event_title, ''), '-', ' '), '''', '')), ?) > 0)
             OR (? != '' AND instr(LOWER(REPLACE(REPLACE(IFNULL(clips.artist_name, ''), '-', ' '), '''', '')), ?) > 0)
           )
         LIMIT 200`,
      )
      .bind(venueKey, venueKey, titleKey, titleKey, artistKey, artistKey)
      .all();
    const clips = ((result.results ?? []) as Array<Record<string, unknown>>).map(clipToPastShowRow);
    const link = showPageIdForPastShowCard(card, clips);
    if (!link || link.showId === id) return null;
    return link.showId;
  } catch (e) {
    console.error('clipShowIdForAttendedMark', e);
    return null;
  }
}

/** GET /api/users/:userId/attended-shows — public past shows the user marked as went. */
export async function getUserAttendedShows(c: Context) {
  const userIdParam = c.req.param('userId') ?? '';
  const mochaUser = c.get('user');
  const targetId =
    userIdParam === 'me' && mochaUser ? mochaUserIdKey(mochaUser) : userIdParam;

  if (userIdParam === 'me' && !mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (!isUserFollowTargetId(targetId)) {
    return c.json({ error: 'User not found' }, 404);
  }

  const directions = mochaUser
    ? await getBlockDirections(c.env.DB, mochaUserIdKey(mochaUser), targetId)
    : { blocked: false, blockedByThem: false };
  if (directions.blockedByThem) {
    return c.json({ error: 'User not found' }, 404);
  }
  if (directions.blocked) {
    return c.json({ shows: [] });
  }

  const parsedLimit = Number(c.req.query('limit'));
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 48, 1), 48);

  try {
    await promoteStartedGoingMarksForUser(c.env.DB, targetId);

    const rows = await c.env.DB.prepare(
      `SELECT * FROM user_show_marks
       WHERE mocha_user_id = ? AND status = 'attended'
       ORDER BY
         CASE WHEN start_date IS NULL OR start_date = '' THEN 1 ELSE 0 END,
         start_date DESC
       LIMIT ?`,
    )
      .bind(targetId, limit)
      .all();

    const marks = ((rows.results ?? []) as Record<string, unknown>[])
      .map(rowToMark)
      .filter((mark) => isProfilePastShowMark(mark));

    let shows = collapsePastShowRows(
      marks.map((mark) => pastShowCardToListRow(userShowMarkToPastShowSummary(mark))),
    );
    shows = await attachClipStatsToPastShows(c.env.DB, shows);
    shows = await attachPastShowArtistImages(c.env.DB, shows);
    return c.json({ shows: shows.map(pastShowListRowToCard) });
  } catch (e) {
    console.error('getUserAttendedShows', e);
    return c.json({ error: 'Failed to load past shows' }, 500);
  }
}

function markToPastShowRow(mark: UserShowMark): PastShowListRow {
  return pastShowCardToListRow(userShowMarkToPastShowSummary(mark));
}

/** Reuse an existing mark when this write is the same concert under a new id. */
async function existingShowMarkForSameConcert(
  db: D1Database,
  userId: string,
  input: ShowMarkUpsertInput,
): Promise<UserShowMark | null> {
  const incoming = markToPastShowRow({
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
  });
  const rows = await db
    .prepare(`SELECT * FROM user_show_marks WHERE mocha_user_id = ?`)
    .bind(userId)
    .all();
  for (const raw of rows.results ?? []) {
    const mark = rowToMark(raw as Record<string, unknown>);
    if (mark.jambase_event_id === input.jambase_event_id) continue;
    if (pastShowsAreSameConcert(incoming, markToPastShowRow(mark))) return mark;
  }
  return null;
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
  const archival = isArchivalShowId(input.jambase_event_id);
  if (!archival && input.status === 'going' && !goingMarkAllowed(input)) {
    return c.json(
      { error: 'Going is only for upcoming shows. Mark past shows as Went instead.' },
      400,
    );
  }
  if (
    !archival &&
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
    const folded = await existingShowMarkForSameConcert(c.env.DB, uid, input);
    const eventId = folded?.jambase_event_id || input.jambase_event_id;
    const startDate = folded?.start_date?.trim() || input.start_date || null;

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
        eventId,
        input.jambase_venue_id ?? null,
        input.jambase_artist_id ?? null,
        input.event_title ?? null,
        input.artist_name ?? null,
        input.venue_name ?? null,
        input.venue_location ?? null,
        input.venue_timezone ?? null,
        startDate,
      )
      .run();

    const row = await c.env.DB.prepare(
      `SELECT * FROM user_show_marks WHERE mocha_user_id = ? AND jambase_event_id = ?`,
    )
      .bind(uid, eventId)
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
