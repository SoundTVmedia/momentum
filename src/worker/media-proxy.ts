import type { Context } from 'hono';
import {
  base64UrlToUtf8,
  isProxyableMediaHost,
} from '../shared/media-proxy';

const MAX_UPSTREAM_BYTES = 8 * 1024 * 1024;

/** Browser-like UA — some CDNs (JamBase/CF Polish) behave differently for bots. */
const UPSTREAM_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map((p) => Number(p));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      const [a, b] = parts;
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
    }
  }
  return false;
}

function parseUpstreamUrl(raw: string | null | undefined): URL | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (isBlockedHostname(parsed.hostname)) return null;
  if (!isProxyableMediaHost(parsed.hostname)) return null;
  return parsed;
}

function resolveUpstreamFromRequest(c: Context): URL | null {
  const token = c.req.param('token');
  if (token) {
    return parseUpstreamUrl(base64UrlToUtf8(token));
  }
  return parseUpstreamUrl(c.req.query('url'));
}

/**
 * Cloudflare Polish often rewrites PNG/JPEG bodies while leaving a stale Content-Type
 * (e.g. image/png header + JPEG bytes). With `X-Content-Type-Options: nosniff`,
 * WKWebView rejects those as broken images (blue "?").
 */
export function sniffImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // ISO BMFF (AVIF/HEIC): ....ftypXXXX
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heif' || brand === 'mif1') return 'image/heic';
  }
  return null;
}

function headerImageContentType(raw: string | null): string | null {
  const ct = (raw || '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ct.startsWith('image/')) return null;
  if (ct === 'image/jpg') return 'image/jpeg';
  return ct;
}

/**
 * Same-origin proxy for JamBase / Unsplash images.
 * Capacitor iOS WKWebView often fails direct third-party image loads (blue "?" tile).
 */
export async function proxyExternalMedia(c: Context): Promise<Response> {
  const upstream = resolveUpstreamFromRequest(c);
  if (!upstream) {
    return c.json({ error: 'Invalid or disallowed media url' }, 400);
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Prefer original raster formats; still sniff body in case Polish rewrites bytes.
        Accept: 'image/png,image/jpeg,image/webp,image/gif,image/*;q=0.8,*/*;q=0.5',
        'Accept-Encoding': 'identity',
        'User-Agent': UPSTREAM_UA,
      },
    });
  } catch (err) {
    console.error('media proxy fetch failed', upstream.hostname, err);
    return c.json({ error: 'Upstream media fetch failed' }, 502);
  }

  if (!upstreamRes.ok) {
    return c.json(
      { error: 'Upstream media unavailable', status: upstreamRes.status },
      502,
    );
  }

  const contentLengthHeader = upstreamRes.headers.get('content-length');
  if (contentLengthHeader) {
    const len = Number(contentLengthHeader);
    if (Number.isFinite(len) && len > MAX_UPSTREAM_BYTES) {
      return c.json({ error: 'Upstream media too large' }, 502);
    }
  }

  const buf = new Uint8Array(await upstreamRes.arrayBuffer());
  if (buf.byteLength === 0) {
    return c.json({ error: 'Upstream media empty' }, 502);
  }
  if (buf.byteLength > MAX_UPSTREAM_BYTES) {
    return c.json({ error: 'Upstream media too large' }, 502);
  }

  const sniffed = sniffImageContentType(buf);
  const declared = headerImageContentType(upstreamRes.headers.get('content-type'));
  // Trust bytes only — CF Polish frequently mismatches extension/MIME.
  // Never fall back to an unverified declared type: WKWebView + nosniff rejects
  // JPEG bodies labeled as image/png (common on JamBase).
  const contentType = sniffed;
  if (!contentType) {
    return c.json(
      {
        error: 'Upstream response is not a recognizable image',
        declaredContentType: declared,
      },
      502,
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(buf.byteLength));
  headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  // Prevent Cloudflare edge from reusing older wrong Content-Type responses.
  headers.set('CDN-Cache-Control', 'public, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Media-Proxy-Version', '2');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  // capacitor:// and ionic:// WebViews load absolute https proxy URLs cross-origin.
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Vary', 'Accept');

  return new Response(buf, {
    status: 200,
    headers,
  });
}
