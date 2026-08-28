import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ClipPlaybackFields,
  resolveClipPosterCandidates,
  resolveFeedPreviewVideoSrc,
} from '@/shared/clip-playback';

function samplePosterStats(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { mean: number; std: number } {
  const target = 4096;
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / target)));
  let sum = 0;
  let n = 0;
  const samples: number[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (Math.min(y, height - 1) * width + Math.min(x, width - 1)) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const yv = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += yv;
      samples.push(yv);
      n++;
    }
  }
  const mean = n > 0 ? sum / n : 0;
  let varSum = 0;
  for (const yv of samples) {
    const d = yv - mean;
    varSum += d * d;
  }
  return { mean, std: n > 0 ? Math.sqrt(varSum / n) : 0 };
}

/** True for solid black, flash-white, or other uniform placeholder frames. */
export function posterPixelsLookUnusable(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  const { mean, std } = samplePosterStats(data, width, height);
  if (mean < 10) return true;
  if (mean > 245 && std < 12) return true;
  if (std < 6) return true;
  return false;
}

export type PosterImageUsability = 'usable' | 'unusable' | 'unknown';

/** Classify a loaded poster. `unknown` means the canvas could not be sampled (CORS). */
export function posterImageUsability(img: HTMLImageElement): PosterImageUsability {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return 'unusable';

  const w = Math.min(64, nw);
  const h = Math.min(64, nh);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 'unknown';

  try {
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return posterPixelsLookUnusable(data.data, w, h) ? 'unusable' : 'usable';
  } catch {
    return 'unknown';
  }
}

/** True when a loaded poster looks like an undecoded / all-black frame. */
export function isLikelyBlackPosterImage(img: HTMLImageElement): boolean {
  return posterImageUsability(img) === 'unusable';
}

export function clipPosterCrossOrigin(src: string): 'anonymous' | undefined {
  return src.includes('videodelivery.net') || src.includes('cloudflarestream.com')
    ? 'anonymous'
    : undefined;
}

const EXTRACTED_POSTER_CACHE_LIMIT = 48;
const extractedPosterCache = new Map<string, string>();

function rememberExtractedPoster(videoSrc: string, dataUrl: string): void {
  if (extractedPosterCache.has(videoSrc)) extractedPosterCache.delete(videoSrc);
  extractedPosterCache.set(videoSrc, dataUrl);
  while (extractedPosterCache.size > EXTRACTED_POSTER_CACHE_LIMIT) {
    const oldest = extractedPosterCache.keys().next().value;
    if (oldest == null) break;
    extractedPosterCache.delete(oldest);
  }
}

export function useClipPosterSrc(clip: ClipPlaybackFields) {
  const urlCandidates = useMemo(
    () => resolveClipPosterCandidates(clip),
    [
      clip.thumbnail_url,
      clip.stream_thumbnail_url,
      clip.stream_video_id,
      clip.stream_playback_url,
      clip.video_url,
      clip.r2_raw_key,
    ],
  );

  const videoSrc = useMemo(() => resolveFeedPreviewVideoSrc(clip), [
    clip.stream_video_id,
    clip.stream_playback_url,
    clip.video_url,
    clip.r2_raw_key,
    clip.stream_mp4_url,
    clip.stream_mp4_status,
  ]);

  const cached = videoSrc ? extractedPosterCache.get(videoSrc) ?? null : null;
  const [index, setIndex] = useState(0);
  const [extractedSrc, setExtractedSrc] = useState<string | null>(cached);
  const [rejectStored, setRejectStored] = useState(Boolean(cached));
  const [acceptedUrl, setAcceptedUrl] = useState('');

  useEffect(() => {
    const nextCached = videoSrc ? extractedPosterCache.get(videoSrc) ?? null : null;
    setIndex(0);
    setExtractedSrc(nextCached);
    setRejectStored(Boolean(nextCached));
    setAcceptedUrl('');
  }, [urlCandidates, videoSrc]);

  const cacheExtractedPoster = useCallback(
    (dataUrl: string) => {
      if (!videoSrc || !dataUrl) return;
      rememberExtractedPoster(videoSrc, dataUrl);
      setExtractedSrc(dataUrl);
    },
    [videoSrc],
  );

  const advanceOrExtract = useCallback(() => {
    setAcceptedUrl('');
    if (index + 1 < urlCandidates.length) {
      setIndex((i) => i + 1);
      return;
    }
    setRejectStored(true);
  }, [index, urlCandidates.length]);

  const urlSrc = rejectStored ? '' : (urlCandidates[index] ?? '');
  const probeSrc = extractedSrc || acceptedUrl ? '' : urlSrc;
  const src = extractedSrc ?? acceptedUrl;

  const onError = useCallback(() => {
    if (extractedSrc) return;
    advanceOrExtract();
  }, [advanceOrExtract, extractedSrc]);

  const onLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (extractedSrc) return;
      const usability = posterImageUsability(event.currentTarget);
      if (usability === 'unusable' || (usability === 'unknown' && videoSrc)) {
        advanceOrExtract();
        return;
      }
      setAcceptedUrl(urlSrc);
    },
    [advanceOrExtract, extractedSrc, urlSrc, videoSrc],
  );

  return {
    src,
    probeSrc,
    videoSrc,
    onError,
    onLoad,
    crossOrigin: extractedSrc
      ? undefined
      : clipPosterCrossOrigin(src || probeSrc),
    cacheExtractedPoster,
  };
}
