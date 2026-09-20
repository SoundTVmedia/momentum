export {
  STREAM_DELIVERY_ORIGIN,
  STREAM_POSTER_SEEK_TIMES,
  type ClipPlaybackFields,
  extractStreamVideoId,
  feedTileUsesStaticPoster,
  isPlaceholderVideoUrl,
  isUsablePosterImageUrl,
  r2ClipFilePath,
  r2KeyFromClipFileUrl,
  readyStreamMp4Url,
  resolveClipPosterCandidates,
  resolveClipPosterUrl,
  streamThumbnailUrl,
  streamVideoIdFromClip,
} from './clip-poster-url';

import {
  type ClipPlaybackFields,
  isPlaceholderVideoUrl,
  r2ClipFilePath,
  r2KeyFromClipFileUrl,
  readyStreamMp4Url,
  resolveClipPosterCandidates,
  resolveClipPosterUrl,
  STREAM_DELIVERY_ORIGIN,
  streamVideoIdFromClip,
} from './clip-poster-url';

/** Duration buckets for playback telemetry (inclusive upper bound except 60s+). */
export const PLAYBACK_DURATION_BUCKETS = ['0-15s', '15-30s', '30-45s', '45-60s', '60s+'] as const;
export type PlaybackDurationBucket = (typeof PLAYBACK_DURATION_BUCKETS)[number];

export function playbackDurationBucket(durationSec: number): PlaybackDurationBucket {
  const d = Number.isFinite(durationSec) ? durationSec : 0;
  if (d <= 15) return '0-15s';
  if (d <= 30) return '15-30s';
  if (d <= 45) return '30-45s';
  if (d <= 60) return '45-60s';
  return '60s+';
}

export function isHlsPlaybackUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('.m3u8') || u.includes('/manifest/video.m3u8');
}

export function streamHlsUrl(videoId: string): string {
  return `${STREAM_DELIVERY_ORIGIN}/${videoId}/manifest/video.m3u8`;
}

/**
 * Stream `clientBandwidthHint` locks the master to one rung — do not put this on
 * the playing URL. Kept for tests and any one-shot fetch that must pin quality.
 */
export const NATIVE_HLS_START_MBPS = 0.8;

/** First fragment: cheapest variant that is still watchable (skip muddy 240p). */
export const HLS_START_MIN_HEIGHT = 360;
/** Next fragment after start: jump toward HD before ABR takes over. */
export const HLS_CLIMB_MIN_HEIGHT = 720;
/** Phone clip modal: never decode above 720p (devicePixelRatio would otherwise allow 1080). */
export const HLS_MOBILE_MAX_HEIGHT = 720;

type HlsLadderLevel = { height?: number; bitrate?: number; bandwidth?: number };

/**
 * Index of the cheapest ladder rung whose height is at least `minHeight`.
 * If every rung is shorter, returns the tallest (still the least-bad start).
 */
export function pickHlsLevelIndexAtLeastHeight(
  levels: readonly HlsLadderLevel[],
  minHeight: number,
): number {
  if (!levels.length) return 0;
  let match = -1;
  let matchBw = Number.POSITIVE_INFINITY;
  let tallest = 0;
  for (let i = 0; i < levels.length; i++) {
    const height = levels[i].height ?? 0;
    const bandwidth = levels[i].bitrate ?? levels[i].bandwidth ?? 0;
    if (height > (levels[tallest].height ?? 0)) tallest = i;
    if (height < minHeight) continue;
    const score = bandwidth > 0 ? bandwidth : height;
    if (match < 0 || score < matchBw) {
      match = i;
      matchBw = score;
    }
  }
  return match >= 0 ? match : tallest;
}

export function hlsStartLevelIndex(levels: readonly HlsLadderLevel[]): number {
  return pickHlsLevelIndexAtLeastHeight(levels, HLS_START_MIN_HEIGHT);
}

export function hlsClimbLevelIndex(levels: readonly HlsLadderLevel[]): number {
  return pickHlsLevelIndexAtLeastHeight(levels, HLS_CLIMB_MIN_HEIGHT);
}

/** Highest ladder index at or below {@link HLS_MOBILE_MAX_HEIGHT}, or -1 if none. */
export function hlsMobileMaxLevelIndex(levels: readonly HlsLadderLevel[]): number {
  if (!levels.length) return -1;
  let best = -1;
  let bestHeight = -1;
  for (let i = 0; i < levels.length; i++) {
    const height = levels[i].height ?? 0;
    if (height <= 0 || height > HLS_MOBILE_MAX_HEIGHT) continue;
    if (height > bestHeight) {
      bestHeight = height;
      best = i;
    }
  }
  return best;
}

function isStreamHlsDeliveryUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!isHlsPlaybackUrl(u)) return false;
  return u.includes('videodelivery.net') || u.includes('cloudflarestream.com');
}

/** Add Cloudflare Stream `clientBandwidthHint` (single rendition closest to `mbps`). */
export function withStreamBandwidthHint(url: string, mbps: number): string {
  const u = url.trim();
  if (!u || !isStreamHlsDeliveryUrl(u) || !Number.isFinite(mbps) || mbps <= 0) return u;
  try {
    const parsed = new URL(u);
    parsed.searchParams.set('clientBandwidthHint', String(mbps));
    return parsed.toString();
  } catch {
    return u;
  }
}

/** Remove `clientBandwidthHint` from a Stream HLS URL. */
export function stripStreamBandwidthHint(url: string): string {
  const u = url.trim();
  if (!u) return u;
  try {
    const parsed = new URL(u);
    if (!parsed.searchParams.has('clientBandwidthHint')) return u;
    parsed.searchParams.delete('clientBandwidthHint');
    return parsed.toString();
  } catch {
    return u;
  }
}

/**
 * Where a Stream progressive MP4 *would* live.
 *
 * Do not use this to play, download or sample a clip: Cloudflare returns 404
 * until that download has been generated for the video, and it answers on the
 * account's customer subdomain rather than this one. Use
 * {@link readyStreamMp4Url}, which only returns a URL Cloudflare confirmed.
 */
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
  // Only a confirmed MP4 — a Stream id alone does not mean one was generated.
  const mp4 = readyStreamMp4Url(clip);
  if (mp4) return mp4;

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  const r2Key = typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '';
  const r2 = r2Key ? r2ClipFilePath(r2Key) : null;

  if (!fallback || isPlaceholderVideoUrl(fallback)) return r2;
  // Grid tiles cannot play HLS, so a Stream clip whose MP4 is still generating
  // previews from the R2 original rather than showing nothing.
  if (isHlsPlaybackUrl(fallback)) return r2;
  return fallback;
}

export type ModalPlaybackSource = {
  /** Primary src: Stream HLS when a Stream id exists, else progressive / R2. */
  src: string;
  poster: string;
  isHls: boolean;
  streamVideoId: string | null;
  /** Adaptive HLS URL when the primary src is not already HLS. */
  hlsFallbackSrc?: string | null;
  /** Confirmed Stream progressive MP4 if HLS fails. */
  mp4FallbackSrc?: string | null;
  /** Original R2 / progressive file when Stream HLS and MP4 both fail. */
  r2FallbackSrc?: string | null;
};

/**
 * What to warm on the network before the user opens a clip.
 * Stream clips prefetch HLS (first segments only). Progressive-only clips
 * warm the MP4 URL without downloading the whole file.
 */
export type ModalPrefetchPlan = {
  progressiveUrl: string | null;
  hlsUrl: string | null;
};

export function resolveModalPrefetchPlan(clip: ClipPlaybackFields): ModalPrefetchPlan {
  const modal = resolveModalPlaybackSource(clip);
  if (!modal.src) return { progressiveUrl: null, hlsUrl: null };
  if (modal.isHls) return { progressiveUrl: null, hlsUrl: modal.src };
  return { progressiveUrl: modal.src, hlsUrl: null };
}

/** Same-origin R2 original, or a non-HLS progressive `video_url`. */
export function resolveR2ProgressiveSrc(clip: ClipPlaybackFields): string | null {
  const r2Key =
    (typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '') ||
    r2KeyFromClipFileUrl(clip.video_url) ||
    '';
  if (r2Key) return r2ClipFilePath(r2Key);

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  if (fallback && !isPlaceholderVideoUrl(fallback) && !isHlsPlaybackUrl(fallback)) {
    return fallback;
  }
  return null;
}

function withDistinctR2Fallback(
  source: Omit<ModalPlaybackSource, 'r2FallbackSrc'>,
  clip: ClipPlaybackFields,
): ModalPlaybackSource {
  const r2 = resolveR2ProgressiveSrc(clip);
  const primary = source.src.trim();
  return {
    ...source,
    r2FallbackSrc: r2 && r2 !== primary ? r2 : null,
  };
}

/**
 * Modal playback: Stream HLS first so the first frame is a small ~360p rung
 * and ABR can climb. Confirmed Stream MP4 then R2 are fallbacks, not the start path.
 */
export function resolveModalPlaybackSource(clip: ClipPlaybackFields): ModalPlaybackSource {
  const streamId = streamVideoIdFromClip(clip);
  const poster = resolveClipPosterUrl(clip);

  if (streamId) {
    const hls = resolveStreamHlsUrl(clip, streamId);
    const mp4 = readyStreamMp4Url(clip);
    return withDistinctR2Fallback(
      {
        src: hls,
        poster,
        isHls: true,
        streamVideoId: streamId,
        hlsFallbackSrc: null,
        mp4FallbackSrc: mp4 && mp4 !== hls ? mp4 : null,
      },
      clip,
    );
  }

  const fallback = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  if (isPlaceholderVideoUrl(fallback)) {
    const r2Key = typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '';
    return withDistinctR2Fallback(
      {
        src: r2Key ? r2ClipFilePath(r2Key) : '',
        poster,
        isHls: false,
        streamVideoId: null,
        hlsFallbackSrc: null,
        mp4FallbackSrc: null,
      },
      clip,
    );
  }
  return withDistinctR2Fallback(
    {
      src: fallback,
      poster,
      isHls: isHlsPlaybackUrl(fallback),
      streamVideoId: null,
      hlsFallbackSrc: null,
      mp4FallbackSrc: null,
    },
    clip,
  );
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

  const variants: Array<{ bandwidth: number; height: number; url: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
    const next = lines[i + 1]?.trim();
    if (!next || next.startsWith('#')) continue;
    const bw = Number(lines[i].match(/BANDWIDTH=(\d+)/i)?.[1]);
    const height = Number(lines[i].match(/RESOLUTION=\d+x(\d+)/i)?.[1]);
    variants.push({
      bandwidth: Number.isFinite(bw) ? bw : Number.POSITIVE_INFINITY,
      height: Number.isFinite(height) ? height : Number.POSITIVE_INFINITY,
      url: toAbsolute(next),
    });
  }
  if (variants.length > 0) {
    const idx = hlsStartLevelIndex(variants);
    return [variants[idx].url];
  }

  const segments: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    segments.push(toAbsolute(line));
    // One start-rung fragment is enough to warm TTFF; extra low-rung
    // segments keep the player fuzzy until they drain.
    if (segments.length >= 1) break;
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
  // Confirmed Stream MP4 first, then the R2 original. Never a constructed
  // /downloads/default.mp4 — that 404s until the download has been generated,
  // which broke both clip download and song identification.
  const mp4 = readyStreamMp4Url(clip);
  if (mp4) return mp4;

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

export function clipIsMarkedUnplayable(clip: ClipPlaybackFields): boolean {
  return clip.playback_unplayable === 1 || clip.playback_unplayable === true;
}

/** True when stored fields point at Stream HLS/MP4 or an R2/progressive file. */
export function clipHasPlayableSource(clip: ClipPlaybackFields): boolean {
  if (streamVideoIdFromClip(clip)) return true;
  if (readyStreamMp4Url(clip)) return true;
  const r2Key =
    (typeof clip.r2_raw_key === 'string' ? clip.r2_raw_key.trim() : '') ||
    r2KeyFromClipFileUrl(clip.video_url) ||
    '';
  if (r2Key) return true;
  const videoUrl = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
  if (videoUrl && !isPlaceholderVideoUrl(videoUrl)) return true;
  return false;
}

/** Stored JPEG, Stream still, or a video URL we can extract a first frame from. */
export function clipHasPosterSource(clip: ClipPlaybackFields): boolean {
  if (resolveClipPosterCandidates(clip).length > 0) return true;
  return Boolean(resolveFeedPreviewVideoSrc(clip));
}

/**
 * Last-line client filter for home/discover/carousels/grids. The worker also
 * excludes `playback_unplayable` rows from public SQL.
 */
export function clipShouldRenderInPublicFeed(clip: ClipPlaybackFields): boolean {
  if (clipIsMarkedUnplayable(clip)) return false;
  if (!clipHasPlayableSource(clip)) return false;
  return clipHasPosterSource(clip);
}

export function filterPublicFeedClips<T extends ClipPlaybackFields>(clips: T[]): T[] {
  return clips.filter((clip) => clipShouldRenderInPublicFeed(clip));
}
