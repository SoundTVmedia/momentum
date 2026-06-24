export {
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

/** Momentum clips are capped at 60s — Stream MP4-first modal playback is safe for all. */
export const MODAL_MP4_FIRST_MAX_DURATION_SEC = 60;

export function isHlsPlaybackUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('.m3u8') || u.includes('/manifest/video.m3u8');
}

export function streamHlsUrl(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/manifest/video.m3u8`;
}

/** Progressive MP4 from Stream CDN — lightweight feed previews (all browsers). */
export function streamMp4Url(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/downloads/default.mp4`;
}

export function resolveStreamHlsUrl(clip: ClipPlaybackFields, streamId: string): string {
  if (
    typeof clip.stream_playback_url === 'string' &&
    isHlsPlaybackUrl(clip.stream_playback_url)
  ) {
    return clip.stream_playback_url.trim();
  }
  return streamHlsUrl(streamId);
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
  /** Primary src for the player (Stream MP4 when available, else HLS / R2 progressive). */
  src: string;
  poster: string;
  isHls: boolean;
  streamVideoId: string | null;
  /** Adaptive HLS URL when modal starts on Stream MP4 (fallback if MP4 fails). */
  hlsFallbackSrc?: string | null;
};

/**
 * Full-quality modal playback: Stream MP4 first for fast start on short clips,
 * HLS adaptive as fallback; direct URL for R2-only clips.
 */
export function resolveModalPlaybackSource(clip: ClipPlaybackFields): ModalPlaybackSource {
  const streamId = streamVideoIdFromClip(clip);
  const poster = resolveClipPosterUrl(clip);

  if (streamId) {
    const hls = resolveStreamHlsUrl(clip, streamId);
    return {
      src: streamMp4Url(streamId),
      poster,
      isHls: false,
      streamVideoId: streamId,
      hlsFallbackSrc: hls,
    };
  }

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  if (isPlaceholderVideoUrl(fallback)) {
    const r2Key = typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '';
    return {
      src: r2Key ? r2ClipFilePath(r2Key) : '',
      poster,
      isHls: false,
      streamVideoId: null,
      hlsFallbackSrc: null,
    };
  }
  return {
    src: fallback,
    poster,
    isHls: isHlsPlaybackUrl(fallback),
    streamVideoId: null,
    hlsFallbackSrc: null,
  };
}

/** Resolve media segment or variant URLs from an HLS manifest (one level). */
export function resolveHlsPrefetchUrls(manifest: string, manifestUrl: string): string[] {
  const lines = manifest.split('\n').map((l) => l.trim());
  const base =
    manifestUrl.lastIndexOf('/') >= 0
      ? manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1)
      : `${manifestUrl}/`;

  const toAbsolute = (line: string) =>
    line.startsWith('http') ? line : new URL(line, base).href;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith('#')) {
        return [toAbsolute(next)];
      }
    }
  }

  const segments: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    segments.push(toAbsolute(line));
    if (segments.length >= 2) break;
  }
  return segments;
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
