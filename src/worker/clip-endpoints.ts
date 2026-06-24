import type { Context } from 'hono';
import { ACR_MAX_SAMPLE_BYTES } from '../shared/identify-music-limits';
import { streamMp4Url } from '../shared/clip-playback';
import { purgeClipFromDatabase } from './clip-delete-utils';
import { normalizeClipApiRows } from './clip-row-normalize';
import { clipsContentFeedColumnReady } from './content-feed-sql';
import { MAIN_FEED_CLIP_SQL } from '../shared/content-feed';
import {
  buildHashtagsForClipBody,
  genreFieldsFromBody,
  songFieldsFromBody,
} from './clip-tag-fields';
import { computeShowId } from '../shared/show-id';
import { resolveClipEventTitle } from '../shared/event-title';
import { createRealtimeService } from './realtime-service';
import { getStaffProfile, isSuperAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';
import {
  describeMusicRecognitionConfig,
  inferIdentifyFilename,
  isMusicRecognitionConfigured,
  recognizeMusic,
} from './music-recognition';

/** Resolve clip id from route params (Hono), query string, or URL path (fallback for some dev/proxy setups). */
function parsePositiveClipIdFromRequest(c: Context<{ Bindings: Env }>): number | null {
  for (const name of ['clipId', 'id'] as const) {
    const raw = c.req.param(name);
    if (raw == null || String(raw).trim() === '') continue;
    const n = Number.parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  for (const qname of ['clipId', 'id'] as const) {
    const raw = c.req.query(qname);
    if (raw == null || String(raw).trim() === '') continue;
    const n = Number.parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  try {
    const path = new URL(c.req.url).pathname.replace(/\/$/, '');
    const last = path.split('/').pop();
    if (last != null && /^\d+$/.test(last)) {
      return Number.parseInt(last, 10);
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Parse clip id from JSON (POST body); tolerates float/string/float-string for D1 + client quirks). */
function parseClipIdFromJson(value: unknown): number | null {
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const n = Math.trunc(value);
    if (n <= 0) return null;
    if (Math.abs(value - n) < 1e-9) return n;
    return null;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return null;
    if (/^\d+$/.test(t)) {
      const n = Number.parseInt(t, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const f = Number(t);
    if (Number.isFinite(f) && f > 0) {
      const n = Math.trunc(f);
      if (Math.abs(f - n) < 1e-9 && n > 0) return n;
    }
    return null;
  }
  return null;
}

function coerceSqliteId(v: unknown): number | null {
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return Math.trunc(v);
  }
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function normalizeMochaUserIdKey(v: string): string {
  return String(v).trim().toLowerCase();
}

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function readClipRowId(row: Record<string, unknown>): unknown {
  return row.id ?? row.ID ?? row._clipRowId ?? row._rowid ?? row.rowid;
}

function readClipMochaUserId(row: Record<string, unknown>): unknown {
  return row.mocha_user_id ?? row.MOCHA_USER_ID;
}

/** Load clip by numeric primary key / rowid (no owner filter). */
async function fetchClipRowByNumericId(
  db: D1Database,
  clipId: number
): Promise<{ id: number; mocha_user_id: string } | null> {
  const n = Math.trunc(clipId);
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = String(n);

  const idQueries: Array<{ sql: string; args: (string | number)[] }> = [
    { sql: 'SELECT rowid AS _rowid, id, mocha_user_id FROM clips WHERE id = ?', args: [n] },
    { sql: 'SELECT rowid AS _rowid, id, mocha_user_id FROM clips WHERE id = ?', args: [s] },
    { sql: 'SELECT rowid AS _rowid, id, mocha_user_id FROM clips WHERE CAST(id AS INTEGER) = ?', args: [n] },
    { sql: 'SELECT rowid AS _rowid, id, mocha_user_id FROM clips WHERE CAST(id AS TEXT) = ?', args: [s] },
    { sql: 'SELECT rowid AS _rowid, id, mocha_user_id FROM clips WHERE rowid = ?', args: [n] },
  ];

  for (const q of idQueries) {
    const row = await db
      .prepare(q.sql)
      .bind(...q.args)
      .first<Record<string, unknown>>();
    if (!row) continue;
    const mid = readClipMochaUserId(row);
    if (mid == null) continue;
    const id = coerceSqliteId(readClipRowId(row));
    if (id == null) continue;
    return { id, mocha_user_id: String(mid) };
  }
  return null;
}

/** When the client id is wrong, Cloudflare Stream uid still identifies the row (scoped to owner). */
async function fetchClipRowByStreamVideoIdForOwner(
  db: D1Database,
  streamVideoId: string,
  ownerKey: string
): Promise<{ id: number; mocha_user_id: string } | null> {
  const sid = String(streamVideoId).trim();
  if (sid === '') return null;

  const row = await db
    .prepare(
      `SELECT rowid AS _rowid, id, mocha_user_id FROM clips
       WHERE stream_video_id = ?
       AND LOWER(TRIM(COALESCE(mocha_user_id, ''))) = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(sid, ownerKey)
    .first<Record<string, unknown>>();

  if (!row) return null;
  const mid = readClipMochaUserId(row);
  if (mid == null) return null;
  const id = coerceSqliteId(readClipRowId(row));
  if (id == null) return null;
  return { id, mocha_user_id: String(mid) };
}

async function fetchClipRowByStreamVideoId(
  db: D1Database,
  streamVideoId: string,
): Promise<{ id: number; mocha_user_id: string } | null> {
  const sid = String(streamVideoId).trim();
  if (sid === '') return null;

  const row = await db
    .prepare(
      `SELECT rowid AS _rowid, id, mocha_user_id FROM clips
       WHERE stream_video_id = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(sid)
    .first<Record<string, unknown>>();

  if (!row) return null;
  const mid = readClipMochaUserId(row);
  if (mid == null) return null;
  const id = coerceSqliteId(readClipRowId(row));
  if (id == null) return null;
  return { id, mocha_user_id: String(mid) };
}

async function resolveClipForSongIdentify(
  c: Context<{ Bindings: Env }>,
  body: Record<string, unknown>,
): Promise<{ id: number; mocha_user_id: string } | Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const ownerKey = normalizeMochaUserIdKey(String(user.id));
  const owned = await resolveMineClipRowFromBody(c.env.DB, body, ownerKey);
  if (owned && normalizeMochaUserIdKey(owned.mocha_user_id) === ownerKey) {
    return owned;
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(user));
  if (!isSuperAdmin(staffProfile)) {
    if (!owned) {
      return c.json({ error: 'Clip not found' }, 404);
    }
    return c.json({ error: 'You can only identify songs on clips you uploaded' }, 403);
  }

  const clipId = parseClipIdFromJson(body.clipId ?? body.clip_id ?? body.id);
  if (clipId != null) {
    const clip = await fetchClipRowByNumericId(c.env.DB, clipId);
    if (clip) return clip;
  }

  const streamVid = trimOrNull(body.streamVideoId ?? body.stream_video_id);
  if (streamVid) {
    const clip = await fetchClipRowByStreamVideoId(c.env.DB, streamVid);
    if (clip) return clip;
  }

  return c.json({ error: 'Clip not found' }, 404);
}

async function fetchClipRowByTextIdForOwner(
  db: D1Database,
  rawId: string,
  ownerKey: string
): Promise<{ id: number; mocha_user_id: string } | null> {
  const idText = String(rawId).trim();
  if (idText === '') return null;

  const row = await db
    .prepare(
      `SELECT rowid AS _rowid, id, mocha_user_id FROM clips
       WHERE CAST(id AS TEXT) = ?
       AND LOWER(TRIM(COALESCE(mocha_user_id, ''))) = ?
       ORDER BY rowid DESC
       LIMIT 1`
    )
    .bind(idText, ownerKey)
    .first<Record<string, unknown>>();

  if (!row) return null;
  const mid = readClipMochaUserId(row);
  if (mid == null) return null;
  const id = coerceSqliteId(readClipRowId(row));
  if (id == null) return null;
  return { id, mocha_user_id: String(mid) };
}

async function fetchClipRowByVideoUrlForOwner(
  db: D1Database,
  videoUrl: string,
  ownerKey: string
): Promise<{ id: number; mocha_user_id: string } | null> {
  const v = String(videoUrl).trim();
  if (v === '') return null;

  const row = await db
    .prepare(
      `SELECT rowid AS _rowid, id, mocha_user_id FROM clips
       WHERE (
         TRIM(COALESCE(video_url, '')) = ?
         OR TRIM(COALESCE(stream_playback_url, '')) = ?
       )
       AND LOWER(TRIM(COALESCE(mocha_user_id, ''))) = ?
       ORDER BY rowid DESC
       LIMIT 1`
    )
    .bind(v, v, ownerKey)
    .first<Record<string, unknown>>();

  if (!row) return null;
  const mid = readClipMochaUserId(row);
  if (mid == null) return null;
  const id = coerceSqliteId(readClipRowId(row));
  if (id == null) return null;
  return { id, mocha_user_id: String(mid) };
}

async function resolveMineClipRowFromBody(
  db: D1Database,
  body: Record<string, unknown>,
  ownerKey: string
): Promise<{ id: number; mocha_user_id: string } | null> {
  const clipId = parseClipIdFromJson(body.clipId ?? body.clip_id ?? body.id);
  const streamVid = trimOrNull(body.streamVideoId ?? body.stream_video_id);
  const rawId = trimOrNull(body.id ?? body.clipId ?? body.clip_id);
  const videoUrl = trimOrNull(body.videoUrl ?? body.video_url ?? body.streamPlaybackUrl ?? body.stream_playback_url);

  let clip = clipId != null ? await fetchClipRowByNumericId(db, clipId) : null;
  if (!clip && streamVid) {
    clip = await fetchClipRowByStreamVideoIdForOwner(db, streamVid, ownerKey);
  }
  if (!clip && rawId) {
    clip = await fetchClipRowByTextIdForOwner(db, rawId, ownerKey);
  }
  if (!clip && videoUrl) {
    clip = await fetchClipRowByVideoUrlForOwner(db, videoUrl, ownerKey);
  }
  return clip;
}

/** Authenticated list of the current user's published clips (same rows as delete/update). */
export async function getMyClipsFeed(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  const sortBy = c.req.query('sort_by') || 'latest';
  const contentFeed = c.req.query('content_feed');
  const offset = (page - 1) * limit;

  const ownerKey = normalizeMochaUserIdKey(String(user.id));
  const hasContentFeedColumn = await clipsContentFeedColumnReady(c.env.DB);

  let query = `
    SELECT 
      clips.rowid AS _clipRowId,
      clips.id AS clip_primary_id,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.is_hidden = 0
    AND (clips.is_draft = 0 OR clips.upload_status IN ('uploading', 'uploaded', 'processing', 'failed'))
    AND LOWER(TRIM(COALESCE(clips.mocha_user_id, ''))) = ?
  `;

  const bindings: unknown[] = [ownerKey];

  if (hasContentFeedColumn && contentFeed === 'pre_post') {
    query += ` AND clips.content_feed = 'pre_post'`;
  } else if (hasContentFeedColumn && contentFeed === 'main') {
    query += ` AND ${MAIN_FEED_CLIP_SQL}`;
  }

  switch (sortBy) {
    case 'trending':
      query += ` ORDER BY clips.likes_count DESC, clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'most_liked':
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case 'most_viewed':
      query += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'top_rated':
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case 'latest':
    default:
      query += ` ORDER BY clips.created_at DESC`;
      break;
  }

  query += ` LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);

  const clips = await c.env.DB.prepare(query).bind(...bindings).all();

  c.header('Cache-Control', 'private, no-store, must-revalidate');
  c.header('Pragma', 'no-cache');

  return c.json({
    clips: normalizeClipApiRows((clips.results || []) as Record<string, unknown>[]),
    page,
    limit,
    hasMore: (clips.results || []).length === limit,
  });
}

async function deleteOwnClipForRow(c: Context<{ Bindings: Env }>, clip: { id: number; mocha_user_id: string }) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (normalizeMochaUserIdKey(clip.mocha_user_id) !== normalizeMochaUserIdKey(String(user.id))) {
    return c.json({ error: 'You can only delete clips you uploaded' }, 403);
  }

  await purgeClipFromDatabase(c.env.DB, clip.id);

  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(clip.id);
  } catch (err) {
    console.error('deleteOwnClip broadcast:', err);
  }

  return c.json({ success: true, deletedId: clip.id }, 200);
}

async function deleteOwnClipWithId(c: Context<{ Bindings: Env }>, clipId: number) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const clip = await fetchClipRowByNumericId(c.env.DB, clipId);

  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  return deleteOwnClipForRow(c, clip);
}

export async function deleteOwnClip(c: Context<{ Bindings: Env }>) {
  const clipId = parsePositiveClipIdFromRequest(c);
  if (clipId == null) {
    return c.json({ error: 'Invalid clip id' }, 400);
  }
  return deleteOwnClipWithId(c, clipId);
}

/** POST with JSON `{ clipId?, streamVideoId?, id?, videoUrl? }` with owner-scoped fallback lookups. */
export async function deleteOwnClipByBody(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Expected JSON body with clipId or streamVideoId' }, 400);
  }

  const ownerKey = normalizeMochaUserIdKey(String(user.id));
  const clipId = parseClipIdFromJson(body.clipId ?? body.clip_id ?? body.id);
  const streamVid = trimOrNull(body.streamVideoId ?? body.stream_video_id);
  const rawId = trimOrNull(body.id ?? body.clipId ?? body.clip_id);
  const videoUrl = trimOrNull(body.videoUrl ?? body.video_url ?? body.streamPlaybackUrl ?? body.stream_playback_url);
  if (clipId == null && streamVid == null && rawId == null && videoUrl == null) {
    return c.json({ error: 'Provide clipId, streamVideoId, id, or videoUrl' }, 400);
  }

  const clip = await resolveMineClipRowFromBody(c.env.DB, body, ownerKey);
  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  return deleteOwnClipForRow(c, clip);
}

/** POST JSON: clipId + optional artist_name, venue_name, location, content_description, hashtags, song_title */
export async function updateOwnClipByBody(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Expected JSON body' }, 400);
  }

  const ownerKey = normalizeMochaUserIdKey(String(user.id));
  const clipId = parseClipIdFromJson(body.clipId ?? body.clip_id ?? body.id);
  const streamVid = trimOrNull(body.streamVideoId ?? body.stream_video_id);
  if (clipId == null && streamVid == null) {
    return c.json({ error: 'Provide clipId or streamVideoId' }, 400);
  }

  const existing = await resolveMineClipRowFromBody(c.env.DB, body, ownerKey);

  if (!existing) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  if (normalizeMochaUserIdKey(existing.mocha_user_id) !== ownerKey) {
    return c.json({ error: 'You can only edit clips you uploaded' }, 403);
  }

  const canonicalId = existing.id;

  const artist_name = trimOrNull(body.artist_name);
  const venue_name = trimOrNull(body.venue_name);
  const location = trimOrNull(body.location);
  const content_description = trimOrNull(body.content_description);
  const { song_title, song_slug } = songFieldsFromBody(body);
  const { genre_name, genre_slug } = genreFieldsFromBody(body);
  const hashtagsJson = JSON.stringify(buildHashtagsForClipBody(body));

  const existingRow = existing as Record<string, unknown>;
  const resolvedArtist =
    artist_name ??
    (typeof existingRow.artist_name === 'string' ? existingRow.artist_name : null);
  const resolvedVenue =
    venue_name ??
    (typeof existingRow.venue_name === 'string' ? existingRow.venue_name : null);
  const resolvedTimestamp =
    typeof existingRow.timestamp === 'string' ? existingRow.timestamp : null;
  const showId = computeShowId({
    jambase_event_id:
      typeof existingRow.jambase_event_id === 'string' ? existingRow.jambase_event_id : null,
    artist_name: resolvedArtist,
    venue_name: resolvedVenue,
    timestamp: resolvedTimestamp,
  });
  const eventTitle = resolveClipEventTitle({
    artist_name: resolvedArtist,
    venue_name: resolvedVenue,
  });

  await c.env.DB.prepare(
    `UPDATE clips SET
      artist_name = ?,
      venue_name = ?,
      location = ?,
      content_description = ?,
      hashtags = ?,
      song_title = ?,
      song_slug = ?,
      genre_name = ?,
      genre_slug = ?,
      show_id = ?,
      event_title = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  )
    .bind(
      artist_name,
      venue_name,
      location,
      content_description,
      hashtagsJson,
      song_title,
      song_slug,
      genre_name,
      genre_slug,
      showId,
      eventTitle,
      canonicalId,
    )
    .run();

  const row = await c.env.DB.prepare(
    `SELECT
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.id = ? OR CAST(clips.id AS TEXT) = ?`
  )
    .bind(canonicalId, String(canonicalId))
    .first();

  if (!row) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(canonicalId);
  } catch (err) {
    console.error('updateOwnClipByBody broadcast:', err);
  }

  const [normalized] = normalizeClipApiRows([row as Record<string, unknown>]);
  return c.json(normalized, 200);
}

/** POST /api/clips/:id/view — increment views (each play / loop from the client). */
export async function postRecordClipView(c: Context<{ Bindings: Env }>) {
  const clipId = parsePositiveClipIdFromRequest(c);
  if (clipId == null) {
    return c.json({ error: 'Invalid clip id' }, 400);
  }

  const exists = await c.env.DB.prepare('SELECT id FROM clips WHERE id = ?')
    .bind(clipId)
    .first();
  if (!exists) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE clips SET views_count = views_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  )
    .bind(clipId)
    .run();

  const row = await c.env.DB.prepare('SELECT views_count FROM clips WHERE id = ?')
    .bind(clipId)
    .first() as { views_count: number } | null;

  return c.json({ views_count: row?.views_count ?? 0 });
}

const CLIP_WITH_USER_FROM = `
  FROM clips
  LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id`;

const CLIP_WITH_USER_SELECT = `
  SELECT
    clips.rowid AS _clipRowId,
    clips.*,
    user_profiles.display_name as user_display_name,
    user_profiles.profile_image_url as user_avatar`;

/** GET /api/clips/:id/related-clips — same show when possible, else same artist (share deep-link swipe). */
export async function getRelatedClipsForShare(c: Context<{ Bindings: Env }>) {
  const clipId = parsePositiveClipIdFromRequest(c);
  if (clipId == null) {
    return c.json({ error: 'Invalid clip id' }, 400);
  }

  const anchor = await c.env.DB.prepare(
    `${CLIP_WITH_USER_SELECT}
     ${CLIP_WITH_USER_FROM}
     WHERE clips.id = ? AND clips.is_hidden = 0`,
  )
    .bind(clipId)
    .first();

  if (!anchor) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  const row = anchor as Record<string, unknown>;
  const artistName = typeof row.artist_name === 'string' ? row.artist_name.trim() : '';
  const showId = typeof row.show_id === 'string' ? row.show_id.trim() : '';
  const jambaseEventId =
    typeof row.jambase_event_id === 'string' ? row.jambase_event_id.trim() : '';
  const venueName = typeof row.venue_name === 'string' ? row.venue_name.trim() : '';
  const timestamp = typeof row.timestamp === 'string' ? row.timestamp.trim() : '';
  const eventTitle = typeof row.event_title === 'string' ? row.event_title.trim() : '';

  type Scope = 'show' | 'artist';
  let scope: Scope = 'artist';
  let results: { results?: unknown[] } = { results: [] };

  if (eventTitle) {
    scope = 'show';
    results = await c.env.DB.prepare(
      `${CLIP_WITH_USER_SELECT}
       ${CLIP_WITH_USER_FROM}
       WHERE clips.is_hidden = 0
       AND clips.is_draft = 0
       AND clips.event_title = ?
       ORDER BY clips.created_at ASC
       LIMIT 50`,
    )
      .bind(eventTitle)
      .all();
  } else if (showId && artistName) {
    scope = 'show';
    results = await c.env.DB.prepare(
      `${CLIP_WITH_USER_SELECT}
       ${CLIP_WITH_USER_FROM}
       WHERE clips.is_hidden = 0
       AND clips.is_draft = 0
       AND clips.artist_name = ?
       AND clips.show_id = ?
       ORDER BY clips.created_at ASC
       LIMIT 50`,
    )
      .bind(artistName, showId)
      .all();
  } else if (jambaseEventId) {
    scope = 'show';
    results = await c.env.DB.prepare(
      `${CLIP_WITH_USER_SELECT}
       ${CLIP_WITH_USER_FROM}
       WHERE clips.is_hidden = 0
       AND clips.is_draft = 0
       AND clips.jambase_event_id = ?
       ORDER BY clips.created_at ASC
       LIMIT 50`,
    )
      .bind(jambaseEventId)
      .all();
  } else if (artistName && venueName && timestamp) {
    scope = 'show';
    results = await c.env.DB.prepare(
      `${CLIP_WITH_USER_SELECT}
       ${CLIP_WITH_USER_FROM}
       WHERE clips.is_hidden = 0
       AND clips.is_draft = 0
       AND clips.artist_name = ?
       AND clips.venue_name = ?
       AND clips.timestamp IS NOT NULL
       AND date(clips.timestamp) = date(?)
       ORDER BY clips.created_at ASC
       LIMIT 50`,
    )
      .bind(artistName, venueName, timestamp)
      .all();
  } else if (artistName) {
    scope = 'artist';
    results = await c.env.DB.prepare(
      `${CLIP_WITH_USER_SELECT}
       ${CLIP_WITH_USER_FROM}
       WHERE clips.is_hidden = 0
       AND clips.is_draft = 0
       AND clips.artist_name = ?
       ORDER BY clips.created_at DESC
       LIMIT 40`,
    )
      .bind(artistName)
      .all();
  }

  const rawRows = (results.results ?? []) as Record<string, unknown>[];
  let clips = normalizeClipApiRows(rawRows);
  const hasAnchor = clips.some((c) => Number(c.id) === clipId);
  if (!hasAnchor) {
    const [anchorNorm] = normalizeClipApiRows([row]);
    if (anchorNorm) {
      clips =
        scope === 'artist'
          ? [anchorNorm, ...clips]
          : [...clips, anchorNorm].sort(
              (a, b) =>
                new Date(String(a.created_at ?? 0)).getTime() -
                new Date(String(b.created_at ?? 0)).getTime(),
            );
    }
  }

  return c.json({ clips, scope });
}

async function readClipVideoSampleForIdentify(
  env: Env,
  row: Record<string, unknown>,
): Promise<{ blob: Blob; filename: string } | null> {
  const max = ACR_MAX_SAMPLE_BYTES;
  const streamId =
    typeof row.stream_video_id === 'string' ? row.stream_video_id.trim() : '';
  if (streamId) {
    const url = streamMp4Url(streamId);
    try {
      const res = await fetch(url, { headers: { Range: `bytes=0-${max - 1}` } });
      if (res.ok || res.status === 206) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) {
          return { blob: new Blob([buf]), filename: 'clip.mp4' };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const r2Key = typeof row.r2_raw_key === 'string' ? row.r2_raw_key.trim() : '';
  if (r2Key) {
    try {
      const obj = await env.R2_BUCKET.get(r2Key, { range: { offset: 0, length: max } });
      if (obj) {
        const buf = await obj.arrayBuffer();
        if (buf.byteLength > 0) {
          return { blob: new Blob([buf]), filename: 'clip.mp4' };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const videoUrl = typeof row.video_url === 'string' ? row.video_url.trim() : '';
  if (videoUrl && !videoUrl.toLowerCase().includes('.m3u8')) {
    try {
      const res = await fetch(videoUrl, { headers: { Range: `bytes=0-${max - 1}` } });
      if (res.ok || res.status === 206) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) {
          const blob = new Blob([buf]);
          return { blob, filename: inferIdentifyFilename(blob) };
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

/** POST JSON — owner or superadmin re-runs ACR on an uploaded clip. */
export async function postIdentifyOwnClipSong(c: Context<{ Bindings: Env }>) {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Expected JSON body' }, 400);
  }

  const resolved = await resolveClipForSongIdentify(c, body);
  if (resolved instanceof Response) {
    return resolved;
  }
  const existing = resolved;

  const configStatus = describeMusicRecognitionConfig(c.env);
  if (!isMusicRecognitionConfigured(c.env)) {
    return c.json({
      ok: false,
      skipped: true,
      message:
        configStatus.hint ??
        'Song ID is not configured. Add ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET on the Worker.',
      config: configStatus,
    });
  }

  const row = await c.env.DB.prepare(
    `SELECT * FROM clips WHERE id = ? OR CAST(id AS TEXT) = ?`,
  )
    .bind(existing.id, String(existing.id))
    .first<Record<string, unknown>>();

  if (!row) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  const sample = await readClipVideoSampleForIdentify(c.env, row);
  if (!sample) {
    return c.json(
      { ok: false, error: 'Could not load video for song recognition on this clip.' },
      422,
    );
  }

  const out = await recognizeMusic(c.env, sample.blob, sample.filename);
  if (!out.ok) {
    return c.json({
      ok: false,
      error: out.error,
      provider: out.provider,
      acrcloudCode: out.acrcloudCode,
      raw: out.raw,
      config: configStatus,
    });
  }
  if (!out.match) {
    return c.json({
      ok: true,
      match: null,
      status: out.status ?? 'no_match',
      provider: out.provider,
      acrcloudCode: out.acrcloudCode,
      skippedReason: out.skippedReason,
      config: configStatus,
    });
  }

  return c.json({
    ok: true,
    match: {
      artist: out.match.artist,
      title: out.match.title,
      album: out.match.album,
      confidence: out.match.confidence,
      isrc: out.match.isrc,
    },
    provider: out.provider,
    config: configStatus,
  });
}

/** POST JSON — superadmin updates clip metadata (song title, artist, caption, etc.). */
export async function postAdminUpdateClipMetadata(c: Context<{ Bindings: Env }>) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(user));
  if (!isSuperAdmin(staffProfile)) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Expected JSON body' }, 400);
  }

  const clipId = parseClipIdFromJson(body.clipId ?? body.clip_id ?? body.id);
  const streamVid = trimOrNull(body.streamVideoId ?? body.stream_video_id);
  if (clipId == null && streamVid == null) {
    return c.json({ error: 'Provide clipId or streamVideoId' }, 400);
  }

  let existing =
    clipId != null ? await fetchClipRowByNumericId(c.env.DB, clipId) : null;
  if (!existing && streamVid) {
    existing = await fetchClipRowByStreamVideoId(c.env.DB, streamVid);
  }
  if (!existing) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  const canonicalId = existing.id;

  const row = await c.env.DB.prepare(
    `SELECT * FROM clips WHERE id = ? OR CAST(id AS TEXT) = ?`,
  )
    .bind(canonicalId, String(canonicalId))
    .first<Record<string, unknown>>();

  if (!row) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  const artist_name = trimOrNull(body.artist_name);
  const venue_name = trimOrNull(body.venue_name);
  const location = trimOrNull(body.location);
  const content_description = trimOrNull(body.content_description);
  const { song_title, song_slug } = songFieldsFromBody(body);
  const { genre_name, genre_slug } = genreFieldsFromBody(body);
  const hashtagsJson = JSON.stringify(buildHashtagsForClipBody(body));
  const jambase_event_id = trimOrNull(body.jambase_event_id);
  const jambase_artist_id = trimOrNull(body.jambase_artist_id);
  const jambase_venue_id = trimOrNull(body.jambase_venue_id);

  const resolvedArtist =
    artist_name ??
    (typeof row.artist_name === 'string' ? row.artist_name : null);
  const resolvedVenue =
    venue_name ??
    (typeof row.venue_name === 'string' ? row.venue_name : null);
  const resolvedTimestamp =
    typeof row.timestamp === 'string' ? row.timestamp : null;
  const showId = computeShowId({
    jambase_event_id,
    artist_name: resolvedArtist,
    venue_name: resolvedVenue,
    timestamp: resolvedTimestamp,
  });
  const explicitEventTitle = trimOrNull(body.event_title);
  const eventTitle =
    explicitEventTitle ??
    resolveClipEventTitle({
      artist_name: resolvedArtist,
      venue_name: resolvedVenue,
    });

  await c.env.DB.prepare(
    `UPDATE clips SET
      artist_name = ?,
      venue_name = ?,
      location = ?,
      content_description = ?,
      hashtags = ?,
      song_title = ?,
      song_slug = ?,
      genre_name = ?,
      genre_slug = ?,
      jambase_event_id = ?,
      jambase_artist_id = ?,
      jambase_venue_id = ?,
      show_id = ?,
      event_title = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
  )
    .bind(
      artist_name,
      venue_name,
      location,
      content_description,
      hashtagsJson,
      song_title,
      song_slug,
      genre_name,
      genre_slug,
      jambase_event_id,
      jambase_artist_id,
      jambase_venue_id,
      showId,
      eventTitle,
      canonicalId,
    )
    .run();

  const updatedRow = await c.env.DB.prepare(
    `SELECT
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.id = ? OR CAST(clips.id AS TEXT) = ?`,
  )
    .bind(canonicalId, String(canonicalId))
    .first();

  if (!updatedRow) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(canonicalId);
  } catch (err) {
    console.error('postAdminUpdateClipMetadata broadcast:', err);
  }

  const [normalized] = normalizeClipApiRows([updatedRow as Record<string, unknown>]);
  return c.json(normalized, 200);
}
