import {
  isHlsPlaybackUrl,
  isPlaceholderVideoUrl,
  isUsablePosterImageUrl,
  r2KeyFromClipFileUrl,
  streamThumbnailUrl,
  streamVideoIdFromClip,
  type ClipPlaybackFields,
} from '../shared/clip-playback';
import { createStreamService, isStreamConfigured } from './stream-service';
import { clipObjectExistsInR2 } from './r2-clip-key';

export const PLAYBACK_SYSTEM_REPORTER = 'system:playback';
export const UNPLAYABLE_FLAG_REASON = 'unplayable_video';
export const PLAYBACK_AUDIT_BATCH = 25;

export type PlaybackAuditClip = ClipPlaybackFields & {
  id: number;
  is_draft?: number | null;
  upload_status?: string | null;
  video_status?: string | null;
};

export type PlaybackAuditDecision =
  | { action: 'skip'; reason: string }
  | { action: 'playable' }
  | { action: 'unplayable'; reason: string }
  | { action: 'check_stream'; streamId: string }
  | { action: 'check_r2'; key: string }
  | { action: 'check_stream_then_r2'; streamId: string; key: string };

export function decidePlaybackAudit(clip: PlaybackAuditClip): PlaybackAuditDecision {
  if (Number(clip.is_draft) === 1) {
    return { action: 'skip', reason: 'draft' };
  }

  const upload = (clip.upload_status ?? 'ready').trim().toLowerCase();
  if (upload === 'uploading' || upload === 'processing') {
    return { action: 'skip', reason: 'still_uploading' };
  }

  const streamId = streamVideoIdFromClip(clip);
  const r2Key =
    (typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '') ||
    r2KeyFromClipFileUrl(clip.video_url) ||
    '';
  const videoUrl = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';

  if (streamId && r2Key) {
    return { action: 'check_stream_then_r2', streamId, key: r2Key };
  }
  if (streamId) return { action: 'check_stream', streamId };
  if (r2Key) return { action: 'check_r2', key: r2Key };

  if (!videoUrl || isPlaceholderVideoUrl(videoUrl)) {
    return { action: 'unplayable', reason: 'placeholder_video_url' };
  }
  if (isHlsPlaybackUrl(videoUrl)) {
    return { action: 'unplayable', reason: 'hls_without_stream' };
  }
  if (/^https?:\/\//i.test(videoUrl)) {
    return { action: 'playable' };
  }

  const videoStatus = typeof clip.video_status === 'string' ? clip.video_status.trim().toLowerCase() : '';
  if (videoStatus === 'error' || videoStatus === 'failed') {
    return { action: 'unplayable', reason: 'failed_source' };
  }

  return { action: 'unplayable', reason: 'no_valid_playback' };
}

/** Persist a Stream still when the row has no usable JPEG poster. */
export function posterUrlToPersist(clip: ClipPlaybackFields): string | null {
  if (isUsablePosterImageUrl(clip.thumbnail_url)) return clip.thumbnail_url!.trim();
  if (isUsablePosterImageUrl(clip.stream_thumbnail_url)) {
    return clip.stream_thumbnail_url!.trim();
  }
  const streamId = streamVideoIdFromClip(clip);
  if (streamId) return streamThumbnailUrl(streamId, { time: '1s', height: 720 });
  return null;
}

async function streamManifestExists(videoId: string): Promise<boolean> {
  const url = `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) return true;
    if (head.status === 404) return false;
    const ranged = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-64' },
    });
    return ranged.ok || ranged.status === 206;
  } catch {
    return false;
  }
}

async function streamSourcePlayable(env: Env, videoId: string): Promise<boolean> {
  if (isStreamConfigured(env)) {
    try {
      const details = await createStreamService(env).getVideoDetails(videoId);
      if (details) return true;
    } catch (err) {
      console.warn(`[playback-health] Stream API lookup failed for ${videoId}:`, err);
    }
  }
  return streamManifestExists(videoId);
}

export async function resolvePlaybackAudit(
  env: Env,
  clip: PlaybackAuditClip,
): Promise<{ playable: boolean; reason: string | null }> {
  const decision = decidePlaybackAudit(clip);
  if (decision.action === 'skip') {
    return { playable: true, reason: null };
  }
  if (decision.action === 'playable') {
    return { playable: true, reason: null };
  }
  if (decision.action === 'unplayable') {
    return { playable: false, reason: decision.reason };
  }

  if (decision.action === 'check_stream') {
    const ok = await streamSourcePlayable(env, decision.streamId);
    return ok
      ? { playable: true, reason: null }
      : { playable: false, reason: 'stream_missing' };
  }

  if (decision.action === 'check_r2') {
    const ok = await clipObjectExistsInR2(env, decision.key);
    return ok ? { playable: true, reason: null } : { playable: false, reason: 'r2_404' };
  }

  const streamOk = await streamSourcePlayable(env, decision.streamId);
  if (streamOk) return { playable: true, reason: null };
  const r2Ok = await clipObjectExistsInR2(env, decision.key);
  return r2Ok ? { playable: true, reason: null } : { playable: false, reason: 'stream_and_r2_missing' };
}

async function persistPosterIfMissing(env: Env, clip: PlaybackAuditClip): Promise<void> {
  const poster = posterUrlToPersist(clip);
  if (!poster) return;
  const nextThumb = isUsablePosterImageUrl(clip.thumbnail_url)
    ? clip.thumbnail_url!.trim()
    : poster;
  const nextStream = isUsablePosterImageUrl(clip.stream_thumbnail_url)
    ? clip.stream_thumbnail_url!.trim()
    : poster;
  if (nextThumb === (clip.thumbnail_url?.trim() ?? '') && nextStream === (clip.stream_thumbnail_url?.trim() ?? '')) {
    return;
  }
  await env.DB.prepare(
    `UPDATE clips
     SET thumbnail_url = ?,
         stream_thumbnail_url = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(nextThumb, nextStream, clip.id)
    .run();
}

async function markUnplayable(env: Env, clipId: number, reason: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE clips
     SET playback_unplayable = 1,
         playback_unplayable_reason = ?,
         playback_checked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(reason, clipId)
    .run();

  const existing = await env.DB.prepare(
    `SELECT id FROM clip_flags
     WHERE clip_id = ? AND reported_by = ?`,
  )
    .bind(clipId, PLAYBACK_SYSTEM_REPORTER)
    .first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE clip_flags
       SET reason = ?, details = ?, status = 'pending', is_urgent = 0,
           reviewed_by = NULL, reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(UNPLAYABLE_FLAG_REASON, reason, (existing as { id: number }).id)
      .run();
    return;
  }

  await env.DB.prepare(
    `INSERT INTO clip_flags (clip_id, reported_by, reason, details, status, is_urgent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
    .bind(clipId, PLAYBACK_SYSTEM_REPORTER, UNPLAYABLE_FLAG_REASON, reason)
    .run();
}

async function markPlayable(env: Env, clipId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE clips
     SET playback_unplayable = 0,
         playback_unplayable_reason = NULL,
         playback_checked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(clipId)
    .run();

  await env.DB.prepare(
    `UPDATE clip_flags
     SET status = 'approved',
         reviewed_by = ?,
         reviewed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE clip_id = ? AND reported_by = ? AND status = 'pending'`,
  )
    .bind(PLAYBACK_SYSTEM_REPORTER, clipId, PLAYBACK_SYSTEM_REPORTER)
    .run();
}

type AuditRow = PlaybackAuditClip & { id: number };

/** Backfill Stream posters and flag clips that cannot be played. */
export async function auditClipPlaybackHealth(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT id, is_draft, upload_status, video_status, video_url, thumbnail_url,
            stream_video_id, stream_playback_url, stream_thumbnail_url,
            stream_mp4_url, stream_mp4_status, r2_raw_key, playback_unplayable
     FROM clips
     WHERE is_draft = 0
       AND COALESCE(status, 'published') = 'published'
       AND COALESCE(upload_status, 'ready') NOT IN ('uploading', 'processing')
       AND datetime(COALESCE(updated_at, created_at)) <= datetime('now', '-15 minutes')
     ORDER BY playback_unplayable DESC, updated_at ASC
     LIMIT ?`,
  )
    .bind(PLAYBACK_AUDIT_BATCH)
    .all();

  for (const raw of rows.results ?? []) {
    const clip = raw as AuditRow;
    try {
      await persistPosterIfMissing(env, clip);
      const result = await resolvePlaybackAudit(env, clip);
      if (result.playable) {
        if (Number(clip.playback_unplayable) === 1) {
          await markPlayable(env, clip.id);
          console.log(`[playback-health] clip ${clip.id}: restored`);
        } else {
          await env.DB.prepare(
            `UPDATE clips SET playback_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
            .bind(clip.id)
            .run();
        }
      } else {
        await markUnplayable(env, clip.id, result.reason ?? 'no_valid_playback');
        console.warn(`[playback-health] clip ${clip.id}: unplayable (${result.reason})`);
      }
    } catch (err) {
      console.error(`[playback-health] clip ${clip.id}:`, err);
    }
  }
}
