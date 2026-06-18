import { r2ClipFilePath } from '../shared/clip-poster-url';
import { createStreamService } from './stream-service';
import { notifyUser } from './notification-utils';
import { createRealtimeService } from './realtime-service';
import * as gamification from './gamification-endpoints';

type UploadedClipRow = {
  id: number;
  mocha_user_id: string;
  artist_name: string | null;
  venue_name: string | null;
  r2_raw_key: string | null;
  thumbnail_url: string | null;
  upload_status: string | null;
  stream_video_id?: string | null;
  is_draft?: number | null;
};

const PROCESSING_BATCH_SIZE = 5;

function publicFileUrl(env: Env, key: string): string {
  const base = (env.PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return `${base}${r2ClipFilePath(key)}`;
}

/** Publish clip with R2 playback so feed tiles work before Stream ingest finishes. */
export async function publishClipWithR2Playback(
  env: Env,
  clipId: number,
  r2Key: string,
  thumbUrl?: string | null,
): Promise<boolean> {
  const key = r2Key.trim();
  if (!key) return false;

  const prior = await env.DB
    .prepare('SELECT is_draft, mocha_user_id, artist_name, venue_name FROM clips WHERE id = ?')
    .bind(clipId)
    .first();

  const playbackUrl = r2ClipFilePath(key);
  await env.DB
    .prepare(
      `UPDATE clips
       SET video_url = ?,
           r2_raw_key = ?,
           thumbnail_url = COALESCE(?, thumbnail_url),
           upload_status = 'uploaded',
           status = 'published',
           is_draft = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(playbackUrl, key, thumbUrl ?? null, clipId)
    .run();

  const wasDraft = Number(prior?.is_draft) === 1;
  if (wasDraft && typeof prior?.mocha_user_id === 'string') {
    try {
      await gamification.awardPoints(env, prior.mocha_user_id, 10, 'Uploaded a concert clip', clipId);
    } catch (err) {
      console.error('publishClipWithR2Playback awardPoints:', err);
    }

    const artist = typeof prior.artist_name === 'string' ? prior.artist_name.trim() : '';
    const venue = typeof prior.venue_name === 'string' ? prior.venue_name.trim() : '';
    const content =
      artist && venue
        ? `Your clip from ${artist} at ${venue} is live!`
        : artist
          ? `Your clip from ${artist} is live!`
          : 'Your clip is live!';

    try {
      await notifyUser(env, prior.mocha_user_id, {
        type: 'clip_published',
        content,
        related_clip_id: clipId,
      });
    } catch (err) {
      console.error('publishClipWithR2Playback notify:', err);
    }
  }

  try {
    const realtime = createRealtimeService(env);
    await realtime.broadcastFeedUpdate(clipId);
  } catch (err) {
    console.error('publishClipWithR2Playback broadcast:', err);
  }

  return wasDraft;
}

/** Fix clips that finished R2 upload but still have placeholder video_url / draft state. */
async function repairStuckR2Clips(env: Env): Promise<void> {
  const rows = await env.DB
    .prepare(
      `SELECT id, r2_raw_key, thumbnail_url
       FROM clips
       WHERE r2_raw_key IS NOT NULL AND trim(r2_raw_key) != ''
         AND (
           video_url IS NULL OR trim(video_url) = '' OR lower(video_url) LIKE 'pending:%'
         )
         AND upload_status IN ('uploaded', 'failed', 'processing')
       ORDER BY updated_at ASC
       LIMIT 20`,
    )
    .all();

  for (const row of rows.results ?? []) {
    const clipId = Number((row as { id: number }).id);
    const r2Key = String((row as { r2_raw_key: string }).r2_raw_key);
    const thumbUrl =
      typeof (row as { thumbnail_url?: string }).thumbnail_url === 'string'
        ? (row as { thumbnail_url: string }).thumbnail_url
        : null;
    await publishClipWithR2Playback(env, clipId, r2Key, thumbUrl);
  }
}

async function processOneUploadedClip(env: Env, clip: UploadedClipRow): Promise<void> {
  const clipId = clip.id;
  const r2Key = clip.r2_raw_key?.trim();
  if (!r2Key) {
    await env.DB
      .prepare(
        `UPDATE clips SET upload_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(clipId)
      .run();
    return;
  }

  const existingStreamId =
    typeof clip.stream_video_id === 'string' ? clip.stream_video_id.trim() : '';
  if (existingStreamId) {
    await env.DB
      .prepare(
        `UPDATE clips SET upload_status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(clipId)
      .run();
    return;
  }

  await publishClipWithR2Playback(env, clipId, r2Key, clip.thumbnail_url);

  await env.DB
    .prepare(
      `UPDATE clips SET upload_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(clipId)
    .run();

  try {
    const streamService = createStreamService(env);
    const sourceUrl = publicFileUrl(env, r2Key);
    const label =
      [clip.artist_name, clip.venue_name].filter(Boolean).join(' @ ') || 'Concert Clip';
    const videoDetails = await streamService.uploadFromUrl(sourceUrl, { name: label });

    const thumbnailUrl = clip.thumbnail_url?.trim() || videoDetails.thumbnail;
    const videoUrl = videoDetails.mp4Url || videoDetails.playbackUrl;
    const posterUrl = clip.thumbnail_url?.trim() || thumbnailUrl;

    await env.DB
      .prepare(
        `UPDATE clips
         SET stream_video_id = ?,
             stream_playback_url = ?,
             stream_thumbnail_url = ?,
             video_url = ?,
             thumbnail_url = ?,
             video_status = ?,
             video_duration = ?,
             upload_status = 'ready',
             status = 'published',
             is_draft = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        videoDetails.uid,
        videoDetails.playbackUrl,
        posterUrl,
        videoUrl,
        posterUrl,
        videoDetails.status,
        videoDetails.duration,
        clipId,
      )
      .run();

    try {
      const realtime = createRealtimeService(env);
      await realtime.broadcastFeedUpdate(clipId);
    } catch (err) {
      console.error('upload-processor broadcast:', err);
    }
  } catch (err) {
    console.error(`upload-processor clip ${clipId}:`, err);
    // Keep R2 playback live; cron will retry Stream ingest.
    await env.DB
      .prepare(
        `UPDATE clips SET upload_status = 'uploaded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(clipId)
      .run();
  }
}

/** Ingest one clip to Stream immediately after multipart complete. */
export async function processClipStreamIngestById(env: Env, clipId: number): Promise<void> {
  const row = await env.DB
    .prepare(
      `SELECT id, mocha_user_id, artist_name, venue_name, r2_raw_key, thumbnail_url, upload_status, stream_video_id, is_draft
       FROM clips WHERE id = ?`,
    )
    .bind(clipId)
    .first();

  if (!row) return;

  const uploadStatus = String(row.upload_status ?? '');
  const streamId = typeof row.stream_video_id === 'string' ? row.stream_video_id.trim() : '';
  if (uploadStatus === 'ready' && streamId) return;

  await processOneUploadedClip(env, row as UploadedClipRow);
}

/** Pick up clips with finished R2 upload and ingest to Stream. */
export async function processUploadedClips(env: Env): Promise<void> {
  await repairStuckR2Clips(env);

  const rows = await env.DB
    .prepare(
      `SELECT id, mocha_user_id, artist_name, venue_name, r2_raw_key, thumbnail_url, upload_status, stream_video_id
       FROM clips
       WHERE upload_status IN ('uploaded', 'failed')
         AND r2_raw_key IS NOT NULL AND trim(r2_raw_key) != ''
         AND (stream_video_id IS NULL OR trim(stream_video_id) = '')
       ORDER BY updated_at ASC
       LIMIT ?`,
    )
    .bind(PROCESSING_BATCH_SIZE)
    .all();

  for (const row of rows.results ?? []) {
    await processOneUploadedClip(env, row as UploadedClipRow);
  }
}

/** Abandon stale upload sessions and mark associated clips failed. */
export async function cleanupStaleUploadSessions(env: Env): Promise<void> {
  const stale = await env.DB
    .prepare(
      `SELECT id, clip_id FROM upload_sessions
       WHERE status IN ('initiated', 'uploading')
         AND expires_at < datetime('now')`,
    )
    .all();

  for (const row of stale.results ?? []) {
    const sessionId = String((row as { id: string }).id);
    const clipId = Number((row as { clip_id: number }).clip_id);

    await env.DB
      .prepare(
        `UPDATE upload_sessions SET status = 'abandoned', updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(sessionId)
      .run();

    await env.DB
      .prepare(
        `UPDATE clips
         SET upload_status = 'failed', is_draft = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND upload_status IN ('uploading', 'pending')`,
      )
      .bind(clipId)
      .run();
  }
}
