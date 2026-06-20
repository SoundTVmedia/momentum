import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ClipPlaybackFields,
  resolveClipPosterCandidates,
  resolveFeedPreviewVideoSrc,
} from '@/shared/clip-playback';
import { captureVideoFrameDataUrl } from '@/react-app/utils/videoThumbnail';

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
  ]);

  const [index, setIndex] = useState(0);
  const [extractedSrc, setExtractedSrc] = useState<string | null>(null);
  const extractAttemptedRef = useRef(false);

  useEffect(() => {
    setIndex(0);
    setExtractedSrc(null);
    extractAttemptedRef.current = false;
  }, [urlCandidates, videoSrc]);

  const tryExtractFrame = useCallback(async () => {
    if (extractAttemptedRef.current || !videoSrc) return;
    extractAttemptedRef.current = true;
    const dataUrl = await captureVideoFrameDataUrl(videoSrc, { maxWidth: 720, quality: 0.85 });
    if (dataUrl) setExtractedSrc(dataUrl);
  }, [videoSrc]);

  useEffect(() => {
    if (urlCandidates.length === 0 && videoSrc) {
      void tryExtractFrame();
    }
  }, [urlCandidates.length, videoSrc, tryExtractFrame]);

  const advanceOrExtract = useCallback(() => {
    if (index + 1 < urlCandidates.length) {
      setIndex((i) => i + 1);
      return;
    }
    void tryExtractFrame();
  }, [index, urlCandidates.length, tryExtractFrame]);

  const urlSrc = urlCandidates[index] ?? '';
  const src = extractedSrc ?? urlSrc;

  const onError = useCallback(() => {
    if (extractedSrc) return;
    advanceOrExtract();
  }, [advanceOrExtract, extractedSrc]);

  const onLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (extractedSrc) return;
      if (isLikelyBlackPosterImage(event.currentTarget)) advanceOrExtract();
    },
    [advanceOrExtract, extractedSrc],
  );

  return {
    src,
    onError,
    onLoad,
    crossOrigin: extractedSrc ? undefined : clipPosterCrossOrigin(src),
  };
}
