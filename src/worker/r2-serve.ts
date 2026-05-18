import type { Context } from 'hono';
import { getClipObjectFromR2, r2ForClipObjectKey } from './r2-clip-key';

async function r2HeadSize(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string
): Promise<number | null> {
  const primary = r2ForClipObjectKey(env, key);
  let head = await primary.head(key);
  if (!head && key.includes('/thumbnail/')) {
    head = await env.R2_BUCKET.head(key);
  }
  return head?.size ?? null;
}

type ByteRange = { offset: number; length: number };

/** Parse `Range: bytes=start-end` (single range only). */
export function parseRangeHeader(
  rangeHeader: string | undefined,
  size: number
): ByteRange | 'unsatisfiable' | null {
  if (!rangeHeader?.trim() || !rangeHeader.startsWith('bytes=')) return null;
  const spec = rangeHeader.slice(6).trim().split(',')[0]?.trim();
  if (!spec) return null;

  const m = /^(\d*)-(\d*)$/.exec(spec);
  if (!m) return null;

  const startStr = m[1];
  const endStr = m[2];

  let start: number;
  let end: number;

  if (startStr === '' && endStr !== '') {
    const suffix = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    if (!Number.isFinite(start) || start < 0) return null;
    if (start >= size) return 'unsatisfiable';
    end = endStr === '' ? size - 1 : Number.parseInt(endStr, 10);
    if (!Number.isFinite(end) || end < start) return null;
    end = Math.min(end, size - 1);
  }

  if (start >= size) return 'unsatisfiable';
  return { offset: start, length: end - start + 1 };
}

/**
 * Serve R2 clip objects with HTTP Range support for faster video start / seeking.
 */
export async function serveR2ClipFile(c: Context): Promise<Response> {
  const rawKey = c.req.param('key');
  if (!rawKey) {
    return c.json({ error: 'File not found' }, 404);
  }
  const key = decodeURIComponent(rawKey);

  try {
    const size = await r2HeadSize(c.env, key);
    if (size == null) {
      return c.json({ error: 'File not found' }, 404);
    }

    const rangeSpec = parseRangeHeader(c.req.header('Range'), size);

    if (rangeSpec === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }

    const object =
      rangeSpec != null
        ? await getClipObjectFromR2(c.env, key, { range: rangeSpec })
        : await getClipObjectFromR2(c.env, key);

    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('accept-ranges', 'bytes');

    if (rangeSpec != null) {
      const end = rangeSpec.offset + rangeSpec.length - 1;
      headers.set('content-range', `bytes ${rangeSpec.offset}-${end}/${size}`);
      headers.set('content-length', String(rangeSpec.length));
      return new Response(object.body, { status: 206, headers });
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('File retrieval error:', error);
    return c.json({ error: 'Failed to retrieve file' }, 500);
  }
}
