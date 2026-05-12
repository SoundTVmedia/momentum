import type { Context } from 'hono';
import { recognizeMusicWithAudD } from './audd-client';

const MAX_SNIPPET_BYTES = 12 * 1024 * 1024;

/**
 * POST multipart/form-data: `file` — short audio/video snippet for [AudD standard recognition](https://docs.audd.io/).
 */
export async function postClipIdentifyMusicAudD(c: Context) {
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
    return c.json({ error: `File too large (max ${MAX_SNIPPET_BYTES} bytes for AudD snippet)` }, 400);
  }

  const token = c.env.AUDD_API_TOKEN;
  if (!token?.trim()) {
    return c.json({ ok: false, skipped: true, message: 'AudD is not configured (set AUDD_API_TOKEN).' });
  }

  const filename =
    typeof (raw as { name?: unknown }).name === 'string' && (raw as { name: string }).name.trim() !== ''
      ? (raw as { name: string }).name
      : 'snippet.webm';

  const out = await recognizeMusicWithAudD(token, blob, filename);

  if (!out.ok) {
    return c.json({ ok: false, error: out.error, audd: out.audd }, 502);
  }
  if (!out.match) {
    return c.json({ ok: true, match: null, status: out.status ?? 'no_match' });
  }

  return c.json({
    ok: true,
    match: out.match,
  });
}
