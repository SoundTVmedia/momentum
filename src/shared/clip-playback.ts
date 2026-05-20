/** Cloudflare Stream public delivery hostname (works for all accounts). */
export const STREAM_DELIVERY_ORIGIN = 'https://videodelivery.net';

export type ClipPlaybackFields = {
  stream_video_id?: string | null;
  stream_playback_url?: string | null;
  stream_thumbnail_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
};

export function isHlsPlaybackUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('.m3u8') || u.includes('/manifest/video.m3u8');
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

export function streamHlsUrl(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/manifest/video.m3u8`;
}

/** Progressive MP4 from Stream CDN — best for muted feed previews (all browsers). */
export function streamMp4Url(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/downloads/default.mp4`;
}

export function streamThumbnailUrl(
  videoId: string,
  opts?: { time?: string; height?: number; width?: number }
): string {
  const params = new URLSearchParams();
  if (opts?.time) params.set('time', opts.time);
  if (opts?.height) params.set('height', String(opts.height));
  if (opts?.width) params.set('width', String(opts.width));
  const q = params.toString();
  const base = `${STREAM_DELIVERY_ORIGIN}/${videoId}/thumbnails/thumbnail.jpg`;
  return q ? `${base}?${q}` : base;
}

export function resolveClipPosterUrl(
  clip: ClipPlaybackFields,
  fallback = ''
): string {
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

/**
 * Video URL for feed tiles: Stream MP4 on CDN when possible; never HLS in grid (too heavy).
 */
export function resolveFeedPreviewVideoSrc(clip: ClipPlaybackFields): string | null {
  const streamId = streamVideoIdFromClip(clip);
  if (streamId) {
    return streamMp4Url(streamId);
  }

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  if (!fallback) return null;
  if (isHlsPlaybackUrl(fallback)) return null;
  return fallback;
}

export type ModalPlaybackSource = {
  /** Primary src for the player (HLS when Stream, else progressive / R2). */
  src: string;
  poster: string;
  isHls: boolean;
  streamVideoId: string | null;
};

/** Full-quality modal playback: adaptive HLS for Stream, direct URL for R2. */
export function resolveModalPlaybackSource(clip: ClipPlaybackFields): ModalPlaybackSource {
  const streamId = streamVideoIdFromClip(clip);
  const poster = resolveClipPosterUrl(clip);

  if (streamId) {
    const hls =
      typeof clip.stream_playback_url === 'string' && isHlsPlaybackUrl(clip.stream_playback_url)
        ? clip.stream_playback_url.trim()
        : streamHlsUrl(streamId);
    return { src: hls, poster, isHls: true, streamVideoId: streamId };
  }

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  return {
    src: fallback,
    poster,
    isHls: isHlsPlaybackUrl(fallback),
    streamVideoId: null,
  };
}

const prefetchedModalSrc = new Set<string>();

/** Warm the network cache for the next/prev clip in a modal feed (best-effort). */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  const { src, isHls } = resolveModalPlaybackSource(clip);
  if (!src || prefetchedModalSrc.has(src)) return;
  prefetchedModalSrc.add(src);

  if (isHls) {
    void fetch(src, { mode: 'cors', credentials: 'omit' }).catch(() => {
      prefetchedModalSrc.delete(src);
    });
    return;
  }

  const el = document.createElement('video');
  el.preload = 'auto';
  el.muted = true;
  el.playsInline = true;
  el.src = src;
  el.load();
}
