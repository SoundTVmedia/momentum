/** Hosts we rewrite through `/api/media/proxy` for Capacitor/WKWebView reliability. */
const PROXY_HOST_SUFFIXES = [
  'jambase.com',
  'unsplash.com',
  'images.unsplash.com',
] as const;

/** Live Workers origin — used when the Capacitor WebView origin is a custom scheme. */
export const DEFAULT_PUBLIC_APP_ORIGIN =
  'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev';

/**
 * Path prefix for proxied media.
 * Bump when proxy response semantics change (e.g. MIME sniffing, no-WebP)
 * so CDNs/clients do not keep stale broken responses.
 */
export const MEDIA_PROXY_PATH_PREFIX = '/api/media/proxy/v3/b';

export function isProxyableMediaHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  return PROXY_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function utf8ToBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToUtf8(token: string): string | null {
  const raw = token.trim();
  if (!raw || raw.length > 4096) return null;
  const pad = raw.length % 4 === 0 ? '' : '='.repeat(4 - (raw.length % 4));
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/') + pad;
  try {
    const binary =
      typeof atob === 'function'
        ? atob(b64)
        : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeMediaProxyToken(url: string): string {
  return utf8ToBase64Url(url);
}

/** True when the URL should be fetched via our same-origin media proxy. */
export function shouldProxyExternalMedia(url: string): boolean {
  const raw = url.trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return false;
  if (raw.includes('/api/media/proxy')) return false;
  if (raw.startsWith('/')) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    return isProxyableMediaHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** Origin for absolute proxy URLs (http(s) page origin, else live Workers URL). */
export function mediaProxyOrigin(preferredOrigin?: string | null): string {
  const preferred = typeof preferredOrigin === 'string' ? preferredOrigin.trim() : '';
  if (preferred.startsWith('http://') || preferred.startsWith('https://')) {
    return preferred.replace(/\/$/, '');
  }
  if (typeof globalThis !== 'undefined') {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    const origin = loc?.origin ?? '';
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin.replace(/\/$/, '');
    }
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}

function pageHasHttpsOrigin(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const origin =
    (globalThis as { location?: { origin?: string } }).location?.origin ?? '';
  return origin.startsWith('http://') || origin.startsWith('https://');
}

export function proxiedMediaPath(url: string): string {
  return `${MEDIA_PROXY_PATH_PREFIX}/${encodeMediaProxyToken(url)}`;
}

/**
 * Build a Capacitor-safe proxy URL.
 * Prefer relative paths on http(s) pages (Capacitor `server.url` / web);
 * absolute Workers URL when the WebView origin is a custom scheme.
 */
export function buildProxiedMediaUrl(
  upstreamUrl: string,
  preferredOrigin?: string | null,
): string {
  const path = proxiedMediaPath(upstreamUrl);
  if (pageHasHttpsOrigin() && !preferredOrigin) {
    return path;
  }
  return `${mediaProxyOrigin(preferredOrigin)}${path}`;
}

/**
 * Upgrade legacy `/api/media/proxy/b/...` or `/v2/b/...` (or query) URLs to the
 * current path prefix so clients do not keep hitting CDN-cached broken responses
 * (wrong MIME, or WebP that iOS WKWebView fails to paint).
 */
export function upgradeLegacyMediaProxyUrl(
  url: string,
  preferredOrigin?: string | null,
): string {
  const raw = url.trim();
  if (!raw.includes('/api/media/proxy')) return raw;
  if (raw.includes(`${MEDIA_PROXY_PATH_PREFIX}/`) || raw.endsWith(MEDIA_PROXY_PATH_PREFIX)) {
    return raw;
  }

  const pathMatch = raw.match(/\/api\/media\/proxy\/(?:v\d+\/)?b\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    const path = `${MEDIA_PROXY_PATH_PREFIX}/${pathMatch[1]}`;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        return `${new URL(raw).origin}${path}`;
      } catch {
        return buildProxiedMediaUrl(
          base64UrlToUtf8(pathMatch[1]) ?? raw,
          preferredOrigin,
        );
      }
    }
    if (pageHasHttpsOrigin() && !preferredOrigin) return path;
    return `${mediaProxyOrigin(preferredOrigin)}${path}`;
  }

  try {
    const abs =
      raw.startsWith('http://') || raw.startsWith('https://')
        ? new URL(raw)
        : new URL(raw, DEFAULT_PUBLIC_APP_ORIGIN);
    const upstream = abs.searchParams.get('url');
    if (upstream && shouldProxyExternalMedia(upstream)) {
      return buildProxiedMediaUrl(upstream, preferredOrigin);
    }
  } catch {
    /* ignore */
  }
  return raw;
}

/**
 * Display URL for remote show/artist images.
 * Capacitor iOS WKWebView often fails direct JamBase/CDN loads (blue "?" tile),
 * and custom-scheme WebViews need an absolute https proxy URL.
 */
export function displayMediaUrl(
  url: string | null | undefined,
  preferredOrigin?: string | null,
): string {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return '';
  if (raw.includes('/api/media/proxy')) {
    return upgradeLegacyMediaProxyUrl(raw, preferredOrigin);
  }
  if (!shouldProxyExternalMedia(raw)) return raw;
  return buildProxiedMediaUrl(raw, preferredOrigin);
}

/** Rewrite a single image field for API responses (absolute proxy URL). */
export function rewriteMediaUrlForClient(
  url: string | null | undefined,
  origin: string,
): string | null {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  if (raw.includes('/api/media/proxy')) {
    return upgradeLegacyMediaProxyUrl(raw, origin);
  }
  if (!shouldProxyExternalMedia(raw)) return raw;
  return `${mediaProxyOrigin(origin)}${proxiedMediaPath(raw)}`;
}

/** Deep-rewrite JamBase event image fields for Capacitor-safe delivery. */
export function rewriteJamBaseEventImages<T extends Record<string, unknown>>(
  event: T,
  origin: string,
): T {
  const next: Record<string, unknown> = { ...event };
  if (typeof next.image === 'string') {
    next.image = rewriteMediaUrlForClient(next.image, origin) ?? next.image;
  }
  const loc = next.location;
  if (loc && typeof loc === 'object' && !Array.isArray(loc)) {
    const location = { ...(loc as Record<string, unknown>) };
    if (typeof location.image === 'string') {
      location.image =
        rewriteMediaUrlForClient(location.image, origin) ?? location.image;
    }
    next.location = location;
  }
  const perf = next.performer;
  if (Array.isArray(perf)) {
    next.performer = perf.map((p) => {
      if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
      const performer = { ...(p as Record<string, unknown>) };
      if (typeof performer.image === 'string') {
        performer.image =
          rewriteMediaUrlForClient(performer.image, origin) ?? performer.image;
      }
      return performer;
    });
  }
  return next as T;
}
