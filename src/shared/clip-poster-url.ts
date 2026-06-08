/** Cloudflare Stream public delivery hostname (works for all accounts). */
export const STREAM_DELIVERY_ORIGIN = 'https://videodelivery.net';

export type ClipPlaybackFields = {
  stream_video_id?: string | null;
  stream_playback_url?: string | null;
  stream_thumbnail_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
};

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

export function resolveClipPosterUrl(clip: ClipPlaybackFields, fallback = ''): string {
  const streamId = streamVideoIdFromClip(clip);
  if (typeof clip.stream_thumbnail_url === 'string' && clip.stream_thumbnail_url.trim()) {
    return clip.stream_thumbnail_url.trim();
  }
  if (typeof clip.thumbnail_url === 'string' && clip.thumbnail_url.trim()) {
    return clip.thumbnail_url.trim();
  }
  if (streamId) {
    return streamThumbnailUrl(streamId, { height: 720 });
  }
  return fallback;
}
