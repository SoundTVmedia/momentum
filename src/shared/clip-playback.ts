export {
  DEFAULT_CLIP_POSTER_FALLBACK,
  STREAM_DELIVERY_ORIGIN,
  STREAM_POSTER_SEEK_TIMES,
  type ClipPlaybackFields,
  extractStreamVideoId,
  feedTileUsesStaticPoster,
  isPlaceholderVideoUrl,
  r2ClipFilePath,
  resolveClipPosterCandidates,
  resolveClipPosterUrl,
  streamThumbnailUrl,
  streamVideoIdFromClip,
} from './clip-poster-url';

import {
  type ClipPlaybackFields,
  isPlaceholderVideoUrl,
  r2ClipFilePath,
  resolveClipPosterUrl,
  STREAM_DELIVERY_ORIGIN,
  streamVideoIdFromClip,
} from './clip-poster-url';

export function isHlsPlaybackUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('.m3u8') || u.includes('/manifest/video.m3u8');
}

export function streamHlsUrl(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/manifest/video.m3u8`;
}

/** Progressive MP4 from Stream CDN — best for muted feed previews (all browsers). */
export function streamMp4Url(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/downloads/default.mp4`;
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
  if (!fallback || isPlaceholderVideoUrl(fallback)) {
    const r2Key = typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '';
    return r2Key ? r2ClipFilePath(r2Key) : null;
  }
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
  if (isPlaceholderVideoUrl(fallback)) {
    const r2Key = typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '';
    return {
      src: r2Key ? r2ClipFilePath(r2Key) : '',
      poster,
      isHls: false,
      streamVideoId: null,
    };
  }
  return {
    src: fallback,
    poster,
    isHls: isHlsPlaybackUrl(fallback),
    streamVideoId: null,
  };
}

const prefetchedModalSrc = new Set<string>();
const prefetchedFeedMp4 = new Set<string>();

/** Warm CDN MP4 for feed hover / scroll (best-effort; avoids HLS in grid). */
export function prefetchFeedPreviewMp4(src: string | null | undefined): void {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url || prefetchedFeedMp4.has(url) || isHlsPlaybackUrl(url)) return;
  prefetchedFeedMp4.add(url);

  // `<link rel=preload as=video>` is not supported in Chromium — use a muted video element instead.
  const el = document.createElement('video');
  el.preload = 'auto';
  el.muted = true;
  el.playsInline = true;
  el.src = url;
  el.load();
  window.setTimeout(() => {
    el.removeAttribute('src');
    el.load();
    el.remove();
  }, 45_000);
}

/** Warm feed MP4 + modal HLS for carousel neighbors on hover (best-effort). */
export function prefetchCarouselNeighborClips(
  neighbors: { next?: ClipPlaybackFields | null; prev?: ClipPlaybackFields | null },
): void {
  for (const clip of [neighbors.prev, neighbors.next]) {
    if (!clip) continue;
    prefetchFeedPreviewMp4(resolveFeedPreviewVideoSrc(clip));
    prefetchModalPlayback(clip);
  }
}

function slugForDownloadFilename(part: string): string {
  return (
    part
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ''
  );
}

/** Progressive MP4 (or same-origin file path) suitable for saving a clip locally. */
export function resolveClipDownloadUrl(clip: ClipPlaybackFields): string | null {
  const streamId = streamVideoIdFromClip(clip);
  if (streamId) return streamMp4Url(streamId);

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  if (!isPlaceholderVideoUrl(fallback) && !isHlsPlaybackUrl(fallback)) {
    return fallback;
  }

  const r2Key = typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '';
  return r2Key ? r2ClipFilePath(r2Key) : null;
}

export function resolveClipDownloadFilename(
  clip: ClipPlaybackFields & {
    artist_name?: string | null;
    venue_name?: string | null;
    id?: number | string | null;
  },
  clipId?: number | string | null,
): string {
  const parts = [clip.artist_name, clip.venue_name]
    .map((v) => (typeof v === 'string' ? slugForDownloadFilename(v) : ''))
    .filter(Boolean);
  const idPart = clipId ?? clip.id;
  const base = parts.length > 0 ? parts.join('-') : idPart != null ? `clip-${idPart}` : 'clip';
  return `${base}.mp4`;
}

/** Warm the network cache for the next/prev clip in a modal feed (best-effort). */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  const { src, isHls } = resolveModalPlaybackSource(clip);
  if (!src || prefetchedModalSrc.has(src)) return;
  prefetchedModalSrc.add(src);

  if (isHls) {
    void fetch(src, { mode: 'cors', credentials: 'omit' } as RequestInit).catch(() => {
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
