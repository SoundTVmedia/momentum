import type { Context } from 'hono';
import {
  describeMusicRecognitionConfig,
  isMusicRecognitionConfigured,
  recognizeMusic,
} from './music-recognition';

const MAX_SNIPPET_BYTES = 12 * 1024 * 1024;

/** GET — which provider/credentials the Worker sees (no secrets returned). */
export async function getClipIdentifyMusicConfig(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json(describeMusicRecognitionConfig(c.env));
}

/**
 * POST multipart/form-data: `file` — short audio/video snippet for music recognition
 * (ACRCloud when configured, otherwise AudD).
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
  /** Workers may surface uploads as `Blob` without `File` prototype. */
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
        'Music recognition is not configured. Add ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET to .dev.vars (see .dev.vars.example).',
      config: configStatus,
    });
  }

  const filename =
    typeof (raw as { name?: unknown }).name === 'string' && (raw as { name: string }).name.trim() !== ''
      ? (raw as { name: string }).name
      : 'snippet.webm';

  const out = await recognizeMusic(c.env, blob, filename);

  if (!out.ok) {
    return c.json(
      {
        ok: false,
        error: out.error,
        provider: out.provider,
        acrcloudCode: out.acrcloudCode,
        raw: out.raw,
      },
      502,
    );
  }
  if (!out.match) {
    return c.json({
      ok: true,
      match: null,
      status: out.status ?? 'no_match',
      provider: configStatus.activeProvider,
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
    provider: configStatus.activeProvider,
  });
}

/** @deprecated Use postClipIdentifyMusic */
export const postClipIdentifyMusicAudD = postClipIdentifyMusic;
