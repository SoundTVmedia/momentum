/** Hosts we rewrite through `/api/media/proxy` for Capacitor/WKWebView reliability. */
const PROXY_HOST_SUFFIXES = [
  'jambase.com',
  'unsplash.com',
  'images.unsplash.com',
] as const;

export function isProxyableMediaHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  return PROXY_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/** True when the URL should be fetched via our same-origin media proxy. */
export function shouldProxyExternalMedia(url: string): boolean {
  const raw = url.trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return false;
  if (raw.startsWith('/')) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    return isProxyableMediaHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Same-origin display URL for remote show/artist images.
 * Capacitor iOS WKWebView often fails direct JamBase/CDN loads (broken-image "?" tile).
 */
export function displayMediaUrl(url: string | null | undefined): string {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return '';
  if (!shouldProxyExternalMedia(raw)) return raw;
  return `/api/media/proxy?url=${encodeURIComponent(raw)}`;
}
