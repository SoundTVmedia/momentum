import type { Context } from 'hono';
import type { ClipPlaybackFailureApiResult } from '../shared/clip-playback-failure';
import { mochaUserIdKey } from './mocha-user-id';
import { isSameMochaUser } from './notification-utils';
import {
  applyClientPlaybackFailure,
  type ClientPlaybackFailureClip,
} from './clip-playback-health';

function parseClipId(raw: string | undefined): number | null {
  const n = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseMediaErrorCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    if (n >= 1 && n <= 4) return n;
  }
  return null;
}

async function playbackReporterKey(userId: string | null, ip: string): Promise<string> {
  if (userId) return userId;
  const seed = `playback:${ip || 'unknown'}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const hex = [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `anon:${hex}`;
}

/** Client player exhausted every source. Hide from feeds when the failure is confirmed. */
export async function postClipPlaybackFailure(c: Context<{ Bindings: Env }>) {
  const clipId = parseClipId(c.req.param('clipId'));
  if (clipId == null) {
    return c.json({ error: 'Invalid clip' }, 400);
  }

  let body: { mediaErrorCode?: unknown } = {};
  try {
    body = (await c.req.json()) as { mediaErrorCode?: unknown };
  } catch {
    body = {};
  }

  const clip = await c.env.DB.prepare(
    `SELECT id, mocha_user_id, is_draft, upload_status, video_status, video_url, thumbnail_url,
            stream_video_id, stream_playback_url, stream_thumbnail_url,
            stream_mp4_url, stream_mp4_status, r2_raw_key, playback_unplayable,
            playback_unplayable_reason
     FROM clips WHERE id = ?`,
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: 'Clip not found' }, 404);
  }

  const mochaUser = c.get('user');
  const reporterId = mochaUser ? mochaUserIdKey(mochaUser) : null;
  const ownerId = String((clip as { mocha_user_id?: unknown }).mocha_user_id ?? '').trim();
  const reporterIsOwner = Boolean(reporterId && ownerId && isSameMochaUser(reporterId, ownerId));
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
  const reporterKey = await playbackReporterKey(reporterId, ip.split(',')[0]?.trim() ?? '');

  const result: ClipPlaybackFailureApiResult = await applyClientPlaybackFailure(c.env, {
    clip: clip as ClientPlaybackFailureClip,
    mediaErrorCode: parseMediaErrorCode(body.mediaErrorCode),
    reporterKey,
    reporterIsOwner,
  });

  return c.json(result);
}
