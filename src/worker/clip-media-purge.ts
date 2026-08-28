import {
  clipR2KeysForPurge,
  clipStreamVideoIdForPurge,
  type ClipStoragePurgeFields,
} from '../shared/clip-storage-purge';
import { r2ForClipObjectKey } from './r2-clip-key';
import { createStreamService, isStreamConfigured } from './stream-service';

const CLIP_MEDIA_SELECT_SQL = `SELECT stream_video_id, stream_playback_url, video_url,
         thumbnail_url, stream_thumbnail_url, r2_raw_key
       FROM clips WHERE id = ? OR rowid = ?`;

export async function loadClipStorageForPurge(
  db: D1Database,
  clipId: number,
): Promise<ClipStoragePurgeFields | null> {
  const id = Math.trunc(clipId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const row = await db
    .prepare(CLIP_MEDIA_SELECT_SQL)
    .bind(id, id)
    .first<ClipStoragePurgeFields>();
  return row ?? null;
}

async function deleteR2ObjectBestEffort(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string,
): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) return;
  try {
    await r2ForClipObjectKey(env, trimmed).delete(trimmed);
  } catch (err) {
    console.error('purgeClip R2 delete failed', trimmed, err);
  }
  if (trimmed.includes('/thumbnail/')) {
    try {
      await env.R2_BUCKET.delete(trimmed);
    } catch (err) {
      console.error('purgeClip R2 thumbnail fallback delete failed', trimmed, err);
    }
  }
}

async function deleteStreamVideoBestEffort(env: Env, videoId: string): Promise<void> {
  if (!isStreamConfigured(env)) return;
  try {
    await createStreamService(env).deleteVideo(videoId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/404|not found/i.test(message)) return;
    console.error('purgeClip Stream delete failed', videoId, err);
  }
}

/** Best-effort R2 + Stream cleanup. Database rows should already be gone. */
export async function purgeClipMedia(
  env: Env,
  row: ClipStoragePurgeFields | null | undefined,
): Promise<void> {
  if (!row) return;
  const keys = clipR2KeysForPurge(row);
  const streamId = clipStreamVideoIdForPurge(row);
  await Promise.all([
    ...keys.map((key) => deleteR2ObjectBestEffort(env, key)),
    streamId ? deleteStreamVideoBestEffort(env, streamId) : Promise.resolve(),
  ]);
}
