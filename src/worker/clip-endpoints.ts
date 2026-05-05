import type { Context } from 'hono';
import { purgeClipFromDatabase } from './clip-delete-utils';
import { normalizeClipApiRows } from './clip-row-normalize';
import { createRealtimeService } from './realtime-service';

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
  const offset = (page - 1) * limit;

  const ownerKey = normalizeMochaUserIdKey(String(user.id));

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
    AND clips.is_draft = 0
    AND LOWER(TRIM(COALESCE(clips.mocha_user_id, ''))) = ?
  `;

  const bindings: unknown[] = [ownerKey];

  switch (sortBy) {
    case 'trending':
      query += ` ORDER BY clips.is_trending_score DESC, clips.created_at DESC`;
      break;
    case 'most_liked':
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case 'most_viewed':
      query += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'top_rated':
      query += ` ORDER BY clips.average_rating DESC, clips.rating_count DESC, clips.created_at DESC`;
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

/** Serialize hashtags for DB (same shape as POST /api/clips). */
function serializeHashtagsForDb(input: unknown): string {
  if (input == null) return JSON.stringify([]);
  if (Array.isArray(input)) {
    const tags = input
      .map((x) => String(x).replace(/^#/, '').trim())
      .filter(Boolean);
    return JSON.stringify(tags);
  }
  if (typeof input === 'string') {
    const tags = input
      .split(/[,]+/)
      .map((s) => s.replace(/^#/, '').trim())
      .filter(Boolean);
    return JSON.stringify(tags);
  }
  return JSON.stringify([]);
}

/** POST JSON: clipId + optional artist_name, venue_name, location, content_description, hashtags */
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
  const hashtagsJson = serializeHashtagsForDb(body.hashtags);

  await c.env.DB.prepare(
    `UPDATE clips SET
      artist_name = ?,
      venue_name = ?,
      location = ?,
      content_description = ?,
      hashtags = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  )
    .bind(artist_name, venue_name, location, content_description, hashtagsJson, canonicalId)
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
