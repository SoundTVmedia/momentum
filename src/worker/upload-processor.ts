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
};

const PROCESSING_BATCH_SIZE = 5;

function publicFileUrl(env: Env, key: string): string {
  const base = (env.PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return `${base}/api/files/${encodeURIComponent(key)}`;
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

    const thumbnailUrl = clip.thumbnail_url || videoDetails.thumbnail;
    const videoUrl = videoDetails.mp4Url || videoDetails.playbackUrl;

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
        thumbnailUrl,
        videoUrl,
        thumbnailUrl,
        videoDetails.status,
        videoDetails.duration,
        clipId,
      )
      .run();

    try {
      await gamification.awardPoints(env, clip.mocha_user_id, 10, 'Uploaded a concert clip', clipId);
    } catch (err) {
      console.error('upload-processor awardPoints:', err);
    }

    try {
      const realtime = createRealtimeService(env);
      await realtime.broadcastFeedUpdate(clipId);
    } catch (err) {
      console.error('upload-processor broadcast:', err);
    }

    const artist = clip.artist_name?.trim();
    const venue = clip.venue_name?.trim();
    const content =
      artist && venue
        ? `Your clip from ${artist} at ${venue} is live!`
        : artist
          ? `Your clip from ${artist} is live!`
          : 'Your clip is live!';

    try {
      await notifyUser(env, clip.mocha_user_id, {
        type: 'clip_published',
        content,
        related_clip_id: clipId,
      });
    } catch (err) {
      console.error('upload-processor notify:', err);
    }
  } catch (err) {
    console.error(`upload-processor clip ${clipId}:`, err);
    await env.DB
      .prepare(
        `UPDATE clips SET upload_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(clipId)
      .run();
  }
}

/** Pick up clips with finished R2 upload and ingest to Stream. */
export async function processUploadedClips(env: Env): Promise<void> {
  const rows = await env.DB
    .prepare(
      `SELECT id, mocha_user_id, artist_name, venue_name, r2_raw_key, thumbnail_url, upload_status
       FROM clips
       WHERE upload_status = 'uploaded'
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
