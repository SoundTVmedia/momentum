import type { Context } from 'hono';
import { MAX_IDENTIFY_UPLOAD_BYTES } from '../shared/identify-music-limits';
import {
  describeMusicRecognitionConfig,
  inferIdentifyFilename,
  isMusicRecognitionConfigured,
  recognizeMusic,
} from './music-recognition';

const MAX_SNIPPET_BYTES = MAX_IDENTIFY_UPLOAD_BYTES;

/** GET — which provider/credentials the Worker sees (no secrets returned). */
export async function getClipIdentifyMusicConfig(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const config = describeMusicRecognitionConfig(c.env);
  return c.json({
    ...config,
    endpoints: {
      config: 'GET /api/clips/identify-music/config',
      identify: 'POST /api/clips/identify-music (multipart field: file)',
    },
    verify: config.acrcloud.ready
      ? `acrcloud.ready is true. Host=${config.acrcloud.host ?? '?'}. Keys are loaded; song ID uses ACRCloud. Code 1001 means "no match" for that audio, not necessarily a missing bucket.`
      : config.hint ?? 'Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET on the Worker.',
    troubleshooting: config.acrcloud.ready
      ? {
          code1001:
            '1001 = no fingerprint match. Common causes: quiet/noisy clip, wrong AVR project keys, or Music bucket not attached to this project.',
          hostMustMatchProject:
            'ACRCLOUD_HOST must be the identify host from the same project as your access key (e.g. identify-us-west-2.acrcloud.com).',
        }
      : null,
  });
}

/**
 * POST multipart/form-data: `file` — short audio/video snippet for music recognition
 * Song ID via ACRCloud only (see music-recognition.ts).
 */
export async function postClipIdentifyMusic(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: FormData;
  try {
    body = await c.req.formData();
  } catch {
    return c.json({ error: 'Expected multipart form data' }, 400);
  }

  const raw = body.get('file');
  if (raw == null) {
    return c.json({ error: 'Missing file field' }, 400);
  }
  const blob = raw as Blob;
  if (typeof blob.arrayBuffer !== 'function' || blob.size === 0) {
    return c.json({ error: 'Missing file field' }, 400);
  }
  if (blob.size > MAX_SNIPPET_BYTES) {
    return c.json({ error: `File too large (max ${MAX_SNIPPET_BYTES} bytes for identify snippet)` }, 400);
  }

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

  const rawName =
    typeof (raw as { name?: unknown }).name === 'string' ? (raw as { name: string }).name : '';
  const filename = inferIdentifyFilename(blob, rawName);

  const out = await recognizeMusic(c.env, blob, filename);

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

/** @deprecated Use postClipIdentifyMusic */
export const postClipIdentifyMusicAudD = postClipIdentifyMusic;
