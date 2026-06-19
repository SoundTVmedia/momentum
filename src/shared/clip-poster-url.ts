/** Cloudflare Stream public delivery hostname (works for all accounts). */
export const STREAM_DELIVERY_ORIGIN = 'https://videodelivery.net';

export type ClipPlaybackFields = {
  stream_video_id?: string | null;
  stream_playback_url?: string | null;
  stream_thumbnail_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  /** Set after multipart upload completes; used when video_url is still a placeholder. */
  r2_raw_key?: string | null;
};

/** Same-origin R2 playback path served by the worker. */
export function r2ClipFilePath(key: string): string {
  return `/api/files/${encodeURIComponent(key.trim())}`;
}

/** Extract Stream UID from stored playback or legacy URLs. */
export function extractStreamVideoId(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const m =
    url.match(/videodelivery\.net\/([a-f0-9]{32})/i) ??
    url.match(/cloudflarestream\.com\/([a-f0-9]{32})/i);
  return m?.[1] ?? null;
}

export function streamVideoIdFromClip(clip: ClipPlaybackFields): string | null {
  const id = typeof clip.stream_video_id === 'string' ? clip.stream_video_id.trim() : '';
  if (id) return id;
  return (
    extractStreamVideoId(clip.stream_playback_url) ?? extractStreamVideoId(clip.video_url)
  );
}

export function streamThumbnailUrl(
  videoId: string,
  opts?: { time?: string; height?: number; width?: number },
): string {
  const params = new URLSearchParams();
  if (opts?.time) params.set('time', opts.time);
  if (opts?.height) params.set('height', String(opts.height));
  if (opts?.width) params.set('width', String(opts.width));
  const q = params.toString();
  const base = `${STREAM_DELIVERY_ORIGIN}/${videoId}/thumbnails/thumbnail.jpg`;
  return q ? `${base}?${q}` : base;
}

/** Clip rows still uploading use a sentinel instead of a real playback URL. */
export function isPlaceholderVideoUrl(url: string | null | undefined): boolean {
  const u = typeof url === 'string' ? url.trim().toLowerCase() : '';
  if (!u) return true;
  return u.startsWith('pending:') || u.startsWith('upload://');
}

function isUsablePosterImageUrl(url: string | null | undefined): boolean {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u) return false;
  const lower = u.toLowerCase();
  if (isPlaceholderVideoUrl(u)) return false;
  if (lower.includes('.m3u8') || lower.includes('/manifest/video.m3u8')) return false;
  if (/\.(mp4|webm|mov|m4v|mkv|avi)(\?|#|$)/i.test(lower)) return false;
  if (lower.includes('/downloads/default.mp4')) return false;
  return true;
}

export function resolveClipPosterUrl(clip: ClipPlaybackFields, fallback = ''): string {
  // Prefer our static R2 JPEG (fast, available immediately after upload).
  if (isUsablePosterImageUrl(clip.thumbnail_url)) {
    return clip.thumbnail_url!.trim();
  }
  if (isUsablePosterImageUrl(clip.stream_thumbnail_url)) {
    return clip.stream_thumbnail_url!.trim();
  }
  const streamId = streamVideoIdFromClip(clip);
  if (streamId) {
    return streamThumbnailUrl(streamId, { height: 720 });
  }
  return fallback;
}

/** Feed grid tiles use a static poster; full playback opens in the modal. */
export function feedTileUsesStaticPoster(_clip: ClipPlaybackFields): boolean {
  return true;
}
