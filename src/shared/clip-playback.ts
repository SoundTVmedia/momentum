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

const prefetchedModalKeys = new Set<string>();
const prefetchedFeedMp4 = new Set<string>();
const prefetchedHlsManifests = new Set<string>();

function modalPrefetchKey(clip: ClipPlaybackFields): string {
  const modal = resolveModalPlaybackSource(clip);
  return modal.streamVideoId ?? modal.src;
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

async function prefetchHlsStartup(hlsUrl: string): Promise<void> {
  const url = hlsUrl.trim();
  if (!url || prefetchedHlsManifests.has(url)) return;
  prefetchedHlsManifests.add(url);

  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HLS manifest ${res.status}`);
    const text = await res.text();
    const nextUrls = resolveHlsPrefetchUrls(text, url);

    if (nextUrls.length === 1 && nextUrls[0].includes('.m3u8')) {
      const variantUrl = nextUrls[0];
      if (!prefetchedHlsManifests.has(variantUrl)) {
        prefetchedHlsManifests.add(variantUrl);
        const variantRes = await fetch(variantUrl, { mode: 'cors', credentials: 'omit' });
        if (variantRes.ok) {
          const variantText = await variantRes.text();
          const segments = resolveHlsPrefetchUrls(variantText, variantUrl);
          await Promise.all(
            segments.map((seg) =>
              fetch(seg, { mode: 'cors', credentials: 'omit' }).catch(() => undefined),
            ),
          );
        }
      }
      return;
    }

    await Promise.all(
      nextUrls.map((seg) =>
        fetch(seg, { mode: 'cors', credentials: 'omit' }).catch(() => undefined),
      ),
    );
  } catch {
    prefetchedHlsManifests.delete(url);
  }
}

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

/** Warm feed MP4 + modal sources for carousel neighbors on hover (best-effort). */
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

/** Warm network cache for modal playback: Stream MP4 + HLS manifest/segments (best-effort). */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  const key = modalPrefetchKey(clip);
  if (!key || prefetchedModalKeys.has(key)) return;
  prefetchedModalKeys.add(key);

  const modal = resolveModalPlaybackSource(clip);

  if (!modal.isHls && modal.src) {
    prefetchFeedPreviewMp4(modal.src);
  } else if (modal.src) {
    void prefetchHlsStartup(modal.src);
  }

  if (modal.hlsFallbackSrc) {
    void prefetchHlsStartup(modal.hlsFallbackSrc);
  }
}

/** Inject preconnect to Stream CDN (idempotent). */
export function preconnectStreamDelivery(): void {
  if (typeof document === 'undefined') return;
  const href = STREAM_DELIVERY_ORIGIN;
  if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  const dns = document.createElement('link');
  dns.rel = 'dns-prefetch';
  dns.href = href;
  document.head.appendChild(dns);
}
