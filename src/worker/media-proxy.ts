import type { Context } from 'hono';
import {
  base64UrlToUtf8,
  isProxyableMediaHost,
} from '../shared/media-proxy';

const MAX_UPSTREAM_BYTES = 8 * 1024 * 1024;

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
        Accept: 'image/*,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        'User-Agent': 'FeedbackMediaProxy/1.0',
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

  const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.startsWith('image/')) {
    return c.json({ error: 'Upstream response is not an image' }, 502);
  }

  const contentLengthHeader = upstreamRes.headers.get('content-length');
  if (contentLengthHeader) {
    const len = Number(contentLengthHeader);
    if (Number.isFinite(len) && len > MAX_UPSTREAM_BYTES) {
      return c.json({ error: 'Upstream media too large' }, 502);
    }
  }

  const headers = new Headers();
  headers.set('Content-Type', contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  const len = upstreamRes.headers.get('content-length');
  if (len) headers.set('Content-Length', len);

  return new Response(upstreamRes.body, {
    status: 200,
    headers,
  });
}
