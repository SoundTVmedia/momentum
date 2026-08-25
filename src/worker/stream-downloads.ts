/**
 * Second half of Stream ingest: turning a Stream video into a progressive MP4.
 *
 * Cloudflare does not serve `/downloads/default.mp4` until that download has
 * been generated for the video, and generation is only accepted once the video
 * is ready to stream. The app built and stored that URL without ever asking for
 * it, so every Stream clip pointed playback, download and song identification
 * at a 404. This runs on the cron: wait for the copy to finish transcoding,
 * request the MP4, then promote the URL Cloudflare hands back.
 */
import {
  createStreamService,
  isStreamConfigured,
  type StreamDownloadState,
} from './stream-service';

const FINALIZE_BATCH_SIZE = 15;
/** Error rows are retried after this delay so a bad generate does not hot-loop the cron. */
export const STREAM_MP4_ERROR_RETRY_MINUTES = 10;
/** After ingest, poll Stream this many times so the MP4 is requested without waiting for cron. */
const MP4_KICK_POLLS = 5;
const MP4_KICK_DELAY_MS = 2_000;

export type StreamDownloadRow = {
  id: number;
  stream_video_id: string | null;
  stream_mp4_status: string | null;
  stream_playback_url: string | null;
};

export type StreamMp4Decision =
  | { action: 'wait'; reason: string }
  | { action: 'request' }
  | { action: 'ready'; url: string }
  | { action: 'error'; reason: string };

/**
 * What to do for one clip, given whether the video finished transcoding and
 * what Cloudflare currently reports about its MP4.
 */
export function decideStreamMp4Step(input: {
  readyToStream: boolean;
  download: StreamDownloadState | null;
}): StreamMp4Decision {
  if (!input.readyToStream) {
    return { action: 'wait', reason: 'video still transcoding' };
  }
  const download = input.download;
  if (!download) return { action: 'request' };
  if (download.status === 'ready') return { action: 'ready', url: download.url };
  if (download.status === 'error') {
    return { action: 'error', reason: 'Cloudflare reported an MP4 generation error' };
  }
  return { action: 'wait', reason: `MP4 ${download.percentComplete}% generated` };
}

async function finalizeOne(env: Env, row: StreamDownloadRow): Promise<void> {
  const videoId = row.stream_video_id?.trim();
  if (!videoId) return;
  const service = createStreamService(env);

  const details = await service.getVideoDetails(videoId);
  if (!details) {
    // The Stream copy is gone; drop the id so ingest can start over from R2.
    await env.DB
      .prepare(
        `UPDATE clips
         SET stream_video_id = NULL, stream_mp4_status = NULL,
             upload_status = 'uploaded', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(row.id)
      .run();
    console.warn(`[stream] clip ${row.id}: video ${videoId} not found, will re-ingest`);
    return;
  }

  const existing =
    row.stream_mp4_status === 'pending' || row.stream_mp4_status === 'error'
      ? null
      : await service.getDownloads(videoId);
  const step = decideStreamMp4Step({ readyToStream: details.readyToStream, download: existing });

  if (step.action === 'wait') {
    console.log(`[stream] clip ${row.id}: ${step.reason}`);
    await touch(env, row.id, existing?.status === 'inprogress' ? 'inprogress' : 'pending');
    return;
  }

  if (step.action === 'request') {
    const created = await service.enableDownloads(videoId);
    if (created?.status === 'ready') {
      await promote(env, row.id, created.url);
      return;
    }
    console.log(`[stream] clip ${row.id}: requested MP4, ${created?.percentComplete ?? 0}%`);
    await touch(env, row.id, 'inprogress');
    return;
  }

  if (step.action === 'error') {
    console.warn(`[stream] clip ${row.id}: ${step.reason}`);
    await touch(env, row.id, 'error');
    return;
  }

  await promote(env, row.id, step.url);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ask Cloudflare for the progressive MP4 as soon as the copy is ready to stream,
 * instead of waiting up to a minute for the cron. Safe to call from waitUntil.
 */
export async function kickStreamMp4Finalize(env: Env, row: StreamDownloadRow): Promise<void> {
  if (!isStreamConfigured(env)) return;
  const videoId = row.stream_video_id?.trim();
  if (!videoId) return;

  const service = createStreamService(env);
  for (let i = 0; i < MP4_KICK_POLLS; i++) {
    const details = await service.getVideoDetails(videoId);
    if (!details) return;
    if (details.readyToStream) {
      await finalizeOne(env, {
        ...row,
        stream_mp4_status: row.stream_mp4_status ?? 'pending',
      });
      return;
    }
    if (i < MP4_KICK_POLLS - 1) await sleep(MP4_KICK_DELAY_MS);
  }
}

/** MP4 confirmed live: it can now back playback, download and song identify. */
async function promote(env: Env, clipId: number, url: string): Promise<void> {
  await env.DB
    .prepare(
      `UPDATE clips
       SET stream_mp4_url = ?, stream_mp4_status = 'ready', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(url, clipId)
    .run();
  console.log(`[stream] clip ${clipId}: MP4 ready ${url}`);
}

async function touch(env: Env, clipId: number, status: string): Promise<void> {
  await env.DB
    .prepare(
      `UPDATE clips SET stream_mp4_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(status, clipId)
    .run();
}

/**
 * Cron step. Picks up clips ingested to Stream whose MP4 is not confirmed yet
 * and moves each one along by a single step, so a stuck video costs one API
 * call per minute rather than blocking the batch.
 */
export async function finalizeStreamDownloads(env: Env): Promise<void> {
  if (!isStreamConfigured(env)) return;

  const rows = await env.DB
    .prepare(
      `SELECT id, stream_video_id, stream_mp4_status, stream_playback_url
       FROM clips
       WHERE stream_video_id IS NOT NULL AND trim(stream_video_id) != ''
         AND (
           stream_mp4_status IS NULL
           OR stream_mp4_status IN ('pending', 'inprogress')
           OR (
             stream_mp4_status = 'error'
             AND updated_at <= datetime('now', '-${STREAM_MP4_ERROR_RETRY_MINUTES} minutes')
           )
         )
       ORDER BY updated_at ASC
       LIMIT ?`,
    )
    .bind(FINALIZE_BATCH_SIZE)
    .all();

  for (const row of rows.results ?? []) {
    const clip = row as StreamDownloadRow;
    try {
      await finalizeOne(env, clip);
    } catch (err) {
      console.error(`[stream] clip ${clip.id} MP4 finalize failed:`, err);
    }
  }
}
