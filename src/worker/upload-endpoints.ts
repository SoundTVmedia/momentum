import type { Context } from 'hono';
import {
  UPLOAD_PART_SIZE_BYTES,
  UPLOAD_SESSION_TTL_HOURS,
  type CompletedUploadPart,
  type UploadInitResponse,
  type UploadStatusResponse,
} from '../shared/upload';
import {
  computeTotalParts,
  presignMultipartPartUrls,
  r2PresignConfigured,
} from './r2-multipart-presign';
import { mochaUserIdKey } from './mocha-user-id';
import {
  deleteUsedClassification,
  insertDraftClipForUpload,
  resolveClipCreateFields,
} from './upload-clip-create';

function newSessionId(): string {
  return `upl_${crypto.randomUUID()}`;
}

function sessionExpiresAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + UPLOAD_SESSION_TTL_HOURS);
  return d.toISOString();
}

function parseCompletedParts(raw: string | null | undefined): CompletedUploadPart[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CompletedUploadPart[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function etagFromPart(part: R2UploadedPart): string {
  return part.etag;
}

async function loadSessionForUser(
  db: D1Database,
  sessionId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const row = await db
    .prepare('SELECT * FROM upload_sessions WHERE id = ?')
    .bind(sessionId)
    .first();
  if (!row) return null;
  if (
    String((row as { mocha_user_id?: string }).mocha_user_id ?? '').toLowerCase() !==
    userId.toLowerCase()
  ) {
    return null;
  }
  return row as Record<string, unknown>;
}

/**
 * POST /api/uploads/init
 * Create draft clip + R2 multipart session.
 */
export async function postUploadInit(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = (await c.req.json()) as Record<string, unknown>;
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'recording.webm';
  const fileSize = typeof body.fileSize === 'number' ? body.fileSize : 0;
  const contentType = typeof body.contentType === 'string' ? body.contentType : 'video/webm';

  if (!fileSize || fileSize <= 0) {
    return c.json({ error: 'fileSize is required' }, 400);
  }

  const resolved = await resolveClipCreateFields(c, body);
  if (!resolved.ok) {
    return c.json({ error: resolved.error }, resolved.status as 400 | 401 | 422);
  }

  const uid = mochaUserIdKey(mochaUser);
  const totalParts = computeTotalParts(fileSize);
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const r2Key = `clips/${uid}/video/${timestamp}_${sanitizedName}`;
  const sessionId = newSessionId();
  const expiresAt = sessionExpiresAt();

  const multipart = await c.env.R2_BUCKET.createMultipartUpload(r2Key, {
    httpMetadata: { contentType },
    customMetadata: { sessionId, clipOwner: uid },
  });

  const clipId = await insertDraftClipForUpload(c.env.DB, resolved.fields, r2Key);
  if (!clipId) {
    await multipart.abort();
    return c.json({ error: 'Failed to create clip record' }, 500);
  }

  await deleteUsedClassification(c.env.DB, resolved.fields.classificationId);

  const uploadMode = r2PresignConfigured(c.env) ? 'direct' : 'worker';
  let partUrls: string[] | undefined;
  if (uploadMode === 'direct') {
    partUrls = await presignMultipartPartUrls(
      c.env,
      r2Key,
      multipart.uploadId,
      totalParts,
    );
  }

  await c.env.DB
    .prepare(
      `INSERT INTO upload_sessions
       (id, clip_id, mocha_user_id, r2_key, multipart_upload_id, total_parts,
        file_size, content_type, file_name, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'initiated', ?, datetime('now'), datetime('now'))`,
    )
    .bind(
      sessionId,
      clipId,
      uid,
      r2Key,
      multipart.uploadId,
      totalParts,
      fileSize,
      contentType,
      sanitizedName,
      expiresAt,
    )
    .run();

  const response: UploadInitResponse = {
    sessionId,
    clipId,
    r2Key,
    multipartUploadId: multipart.uploadId,
    partSize: UPLOAD_PART_SIZE_BYTES,
    totalParts,
    uploadMode,
    partUrls,
    expiresAt,
  };

  return c.json(response, 201);
}

/**
 * PUT /api/uploads/:sessionId/parts/:partNumber
 * Worker-mediated part upload when R2 presign credentials are not configured.
 */
export async function putUploadPart(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sessionId = c.req.param('sessionId') ?? '';
  const partNumber = Number.parseInt(c.req.param('partNumber') || '0', 10);
  if (!sessionId) {
    return c.json({ error: 'Missing session id' }, 400);
  }
  if (!Number.isFinite(partNumber) || partNumber < 1) {
    return c.json({ error: 'Invalid part number' }, 400);
  }

  const uid = mochaUserIdKey(mochaUser);
  const session = await loadSessionForUser(c.env.DB, sessionId, uid);
  if (!session) {
    return c.json({ error: 'Upload session not found' }, 404);
  }

  const status = String(session.status ?? '');
  if (status === 'completed' || status === 'abandoned') {
    return c.json({ error: 'Upload session is closed' }, 409);
  }

  const r2Key = String(session.r2_key);
  const uploadId = String(session.multipart_upload_id);
  const multipart = c.env.R2_BUCKET.resumeMultipartUpload(r2Key, uploadId);
  const body = c.req.raw.body;
  if (!body) {
    return c.json({ error: 'Missing request body' }, 400);
  }
  const part = await multipart.uploadPart(partNumber, body);

  const completed = parseCompletedParts(String(session.completed_parts));
  const etag = etagFromPart(part);
  const withoutDup = completed.filter((p) => p.partNumber !== partNumber);
  withoutDup.push({ partNumber, etag });
  withoutDup.sort((a, b) => a.partNumber - b.partNumber);

  await c.env.DB
    .prepare(
      `UPDATE upload_sessions
       SET completed_parts = ?, status = 'uploading', updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(JSON.stringify(withoutDup), sessionId)
    .run();

  return c.json({
    success: true,
    partNumber,
    etag,
    completedParts: withoutDup.length,
    totalParts: Number(session.total_parts),
  });
}

/**
 * POST /api/uploads/:sessionId/parts/:partNumber/confirm
 * Confirm a part uploaded directly to R2 (presigned URL mode).
 */
export async function postUploadPartConfirm(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sessionId = c.req.param('sessionId') ?? '';
  const partNumber = Number.parseInt(c.req.param('partNumber') || '0', 10);
  if (!sessionId) {
    return c.json({ error: 'Missing session id' }, 400);
  }
  const body = (await c.req.json()) as { etag?: string };
  const etag = typeof body.etag === 'string' ? body.etag : '';

  if (!etag) {
    return c.json({ error: 'etag is required' }, 400);
  }

  const uid = mochaUserIdKey(mochaUser);
  const session = await loadSessionForUser(c.env.DB, sessionId, uid);
  if (!session) {
    return c.json({ error: 'Upload session not found' }, 404);
  }

  const completed = parseCompletedParts(String(session.completed_parts));
  const withoutDup = completed.filter((p) => p.partNumber !== partNumber);
  withoutDup.push({ partNumber, etag });
  withoutDup.sort((a, b) => a.partNumber - b.partNumber);

  await c.env.DB
    .prepare(
      `UPDATE upload_sessions
       SET completed_parts = ?, status = 'uploading', updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(JSON.stringify(withoutDup), sessionId)
    .run();

  return c.json({
    success: true,
    partNumber,
    completedParts: withoutDup.length,
    totalParts: Number(session.total_parts),
  });
}

/**
 * POST /api/uploads/:sessionId/complete
 * Finalize multipart upload and queue clip for processing.
 */
export async function postUploadComplete(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sessionId = c.req.param('sessionId') ?? '';
  if (!sessionId) {
    return c.json({ error: 'Missing session id' }, 400);
  }
  const idempotencyKey =
    c.req.header('Idempotency-Key')?.trim() ||
    c.req.header('idempotency-key')?.trim() ||
    null;

  const uid = mochaUserIdKey(mochaUser);
  const session = await loadSessionForUser(c.env.DB, sessionId, uid);
  if (!session) {
    return c.json({ error: 'Upload session not found' }, 404);
  }

  if (idempotencyKey) {
    const prior = await c.env.DB
      .prepare(
        `SELECT id, clip_id, status FROM upload_sessions
         WHERE idempotency_key = ? AND mocha_user_id = ?`,
      )
      .bind(idempotencyKey, uid)
      .first();
    if (prior && String(prior.id) !== sessionId && String(prior.status) === 'completed') {
      const clip = await c.env.DB
        .prepare('SELECT upload_status FROM clips WHERE id = ?')
        .bind(prior.clip_id)
        .first();
      return c.json({
        success: true,
        sessionId: prior.id,
        clipId: prior.clip_id,
        uploadStatus: clip?.upload_status ?? 'uploaded',
        idempotentReplay: true,
      });
    }
  }

  if (String(session.status) === 'completed') {
    const clip = await c.env.DB
      .prepare('SELECT upload_status FROM clips WHERE id = ?')
      .bind(session.clip_id)
      .first();
    return c.json({
      success: true,
      sessionId,
      clipId: session.clip_id,
      uploadStatus: clip?.upload_status ?? 'uploaded',
      idempotentReplay: true,
    });
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    thumbnailKey?: string;
    thumbnailUrl?: string;
  };

  const completed = parseCompletedParts(String(session.completed_parts));
  const totalParts = Number(session.total_parts);
  if (completed.length < totalParts) {
    return c.json(
      {
        error: 'Not all parts uploaded',
        completedParts: completed.length,
        totalParts,
      },
      400,
    );
  }

  const r2Key = String(session.r2_key);
  const uploadId = String(session.multipart_upload_id);
  const multipart = c.env.R2_BUCKET.resumeMultipartUpload(r2Key, uploadId);

  await multipart.complete(
    completed.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
  );

  const thumbKey = typeof body.thumbnailKey === 'string' ? body.thumbnailKey : null;
  const thumbUrl = typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : null;

  await c.env.DB
    .prepare(
      `UPDATE upload_sessions
       SET status = 'completed',
           idempotency_key = COALESCE(?, idempotency_key),
           thumbnail_key = COALESCE(?, thumbnail_key),
           thumbnail_url = COALESCE(?, thumbnail_url),
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(idempotencyKey, thumbKey, thumbUrl, sessionId)
    .run();

  await c.env.DB
    .prepare(
      `UPDATE clips
       SET upload_status = 'uploaded',
           thumbnail_url = COALESCE(?, thumbnail_url),
           r2_raw_key = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(thumbUrl, r2Key, session.clip_id)
    .run();

  return c.json({
    success: true,
    sessionId,
    clipId: session.clip_id,
    uploadStatus: 'uploaded',
  });
}

/**
 * GET /api/uploads/:sessionId/status
 */
export async function getUploadStatus(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sessionId = c.req.param('sessionId') ?? '';
  if (!sessionId) {
    return c.json({ error: 'Missing session id' }, 400);
  }
  const uid = mochaUserIdKey(mochaUser);
  const session = await loadSessionForUser(c.env.DB, sessionId, uid);
  if (!session) {
    return c.json({ error: 'Upload session not found' }, 404);
  }

  const clip = await c.env.DB
    .prepare('SELECT upload_status, is_draft, status, thumbnail_url FROM clips WHERE id = ?')
    .bind(session.clip_id)
    .first();

  const completed = parseCompletedParts(String(session.completed_parts));
  const totalParts = Number(session.total_parts) || 1;
  const progress = Math.min(100, Math.round((completed.length / totalParts) * 100));

  const response: UploadStatusResponse = {
    sessionId,
    clipId: Number(session.clip_id),
    sessionStatus: String(session.status) as UploadStatusResponse['sessionStatus'],
    uploadStatus: String(clip?.upload_status ?? 'uploading') as UploadStatusResponse['uploadStatus'],
    completedParts: completed.length,
    totalParts,
    progress,
    clipPublished: Number(clip?.is_draft) === 0 && String(clip?.status) === 'published',
    thumbnailUrl:
      typeof clip?.thumbnail_url === 'string' ? clip.thumbnail_url : null,
    completedPartNumbers: completed.map((p) => p.partNumber),
  };

  return c.json(response);
}

/**
 * POST /api/uploads/:sessionId/thumbnail
 * Attach a client-generated JPEG thumbnail to the draft clip (upload early for fast grid display).
 */
export async function postUploadSessionThumbnail(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sessionId = c.req.param('sessionId') ?? '';
  if (!sessionId) {
    return c.json({ error: 'Missing session id' }, 400);
  }

  const body = (await c.req.json()) as { thumbnailUrl?: string; thumbnailKey?: string };
  const thumbnailUrl = typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl.trim() : '';
  const thumbnailKey = typeof body.thumbnailKey === 'string' ? body.thumbnailKey.trim() : '';

  if (!thumbnailUrl) {
    return c.json({ error: 'thumbnailUrl is required' }, 400);
  }

  const uid = mochaUserIdKey(mochaUser);
  const session = await loadSessionForUser(c.env.DB, sessionId, uid);
  if (!session) {
    return c.json({ error: 'Upload session not found' }, 404);
  }

  await c.env.DB
    .prepare(
      `UPDATE upload_sessions
       SET thumbnail_key = COALESCE(?, thumbnail_key),
           thumbnail_url = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(thumbnailKey || null, thumbnailUrl, sessionId)
    .run();

  await c.env.DB
    .prepare(
      `UPDATE clips
       SET thumbnail_url = ?,
           stream_thumbnail_url = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(thumbnailUrl, thumbnailUrl, session.clip_id)
    .run();

  return c.json({
    success: true,
    clipId: session.clip_id,
    thumbnailUrl,
  });
}
