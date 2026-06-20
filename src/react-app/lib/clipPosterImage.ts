import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ClipPlaybackFields,
  DEFAULT_CLIP_POSTER_FALLBACK,
  resolveClipPosterCandidates,
} from '@/shared/clip-playback';

function sampleMeanLuminance(data: Uint8ClampedArray, width: number, height: number): number {
  const target = 4096;
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / target)));
  let sum = 0;
  let n = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (Math.min(y, height - 1) * width + Math.min(x, width - 1)) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

/** True when a loaded poster looks like an undecoded / all-black frame. */
export function isLikelyBlackPosterImage(img: HTMLImageElement): boolean {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return false;

  const w = Math.min(64, nw);
  const h = Math.min(64, nh);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  try {
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return sampleMeanLuminance(data.data, w, h) < 10;
  } catch {
    return false;
  }
}

export function clipPosterCrossOrigin(src: string): 'anonymous' | undefined {
  return src.includes('videodelivery.net') || src.includes('cloudflarestream.com')
    ? 'anonymous'
    : undefined;
}

export function useClipPosterSrc(
  clip: ClipPlaybackFields,
  fallback: string = DEFAULT_CLIP_POSTER_FALLBACK,
) {
  const candidates = useMemo(
    () => resolveClipPosterCandidates(clip, fallback),
    [
      clip.thumbnail_url,
      clip.stream_thumbnail_url,
      clip.stream_video_id,
      clip.stream_playback_url,
      clip.video_url,
      clip.r2_raw_key,
      fallback,
    ],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const src = candidates[Math.min(index, candidates.length - 1)] ?? fallback;
  const atLastCandidate = index >= candidates.length - 1;

  const advance = useCallback(() => {
    setIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
  }, [candidates.length]);

  const onError = useCallback(() => {
    if (!atLastCandidate) advance();
  }, [advance, atLastCandidate]);

  const onLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (atLastCandidate) return;
      if (isLikelyBlackPosterImage(event.currentTarget)) advance();
    },
    [advance, atLastCandidate],
  );

  return {
    src,
    onError,
    onLoad,
    crossOrigin: clipPosterCrossOrigin(src),
  };
}
