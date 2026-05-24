/** Query path that opens a specific clip on the home feed (see `ClipDeepLinkHandler`). */
export function clipSharePath(clipId: number | string): string {
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
