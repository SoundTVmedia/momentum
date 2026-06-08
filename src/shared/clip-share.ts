/** Path for shared clip links (worker injects clip OG thumbnail before SPA loads). */
export function clipSharePath(clipId: number | string): string {
  const id = String(clipId).trim();
  return id ? `/share/clip/${encodeURIComponent(id)}` : '/';
}

/** In-app deep link that opens the clip modal (see `ClipDeepLinkHandler`). */
export function clipDeepLinkPath(clipId: number | string): string {
  const id = String(clipId).trim();
  return id ? `/?clip=${encodeURIComponent(id)}` : '/';
}

/** Absolute URL to watch a single clip (for copy, SMS, social share). */
export function clipShareUrl(clipId: number | string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base.replace(/\/$/, '')}${clipSharePath(clipId)}`;
}
