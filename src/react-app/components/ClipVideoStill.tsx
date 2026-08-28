import { useEffect, useRef, useState } from 'react';

type ClipVideoStillProps = {
  src: string;
  className?: string;
  onCaptured?: (dataUrl: string) => void;
};

function previewSeekTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0.5;
  return Math.min(Math.max(duration * 0.18, 0.35), Math.max(0.2, duration - 0.08));
}

const MAX_STILL_DECODES = 3;
let activeStillDecodes = 0;
const stillDecodeWaiters: Array<() => void> = [];

function acquireClipStillDecode(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      activeStillDecodes += 1;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        activeStillDecodes = Math.max(0, activeStillDecodes - 1);
        const next = stillDecodeWaiters.shift();
        if (next) next();
      });
    };
    if (activeStillDecodes < MAX_STILL_DECODES) grant();
    else stillDecodeWaiters.push(grant);
  });
}

function waitForDecodedFrame(video: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    const finish = () => {
      window.clearTimeout(timer);
      done();
    };
    const rvfc = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }
    ).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      rvfc.call(video, finish);
    }
    const onPlaying = () => {
      requestAnimationFrame(() => requestAnimationFrame(finish));
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) {
      onPlaying();
      return;
    }
    video.addEventListener('playing', onPlaying, { once: true });
    video.addEventListener('loadeddata', onPlaying, { once: true });
  });
}

/**
 * Paused video frame used as a clip poster when no JPEG exists.
 * iOS only paints a frame after a muted play(); we then seek off t=0.
 */
export default function ClipVideoStill({ src, className = '', onCaptured }: ClipVideoStillProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const capturedRef = useRef(false);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;
  const [mayDecode, setMayDecode] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMayDecode(false);
    setHasFrame(false);
    setFailed(false);
    capturedRef.current = false;
    releaseRef.current?.();
    releaseRef.current = null;

    void acquireClipStillDecode().then((rel) => {
      if (cancelled) {
        rel();
        return;
      }
      releaseRef.current = rel;
      setMayDecode(true);
    });

    return () => {
      cancelled = true;
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mayDecode) return;
    capturedRef.current = false;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('muted', '');
    video.preload = 'auto';

    const capture = () => {
      if (capturedRef.current || !video.videoWidth || !video.videoHeight) return;
      if (video.currentTime < 0.2 && Number.isFinite(video.duration) && video.duration > 0.5) {
        return;
      }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 720 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const sample = ctx.getImageData(0, 0, Math.min(64, canvas.width), Math.min(64, canvas.height));
        let sum = 0;
        const pixels = sample.data;
        for (let i = 0; i < pixels.length; i += 16) {
          sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        }
        const mean = sum / Math.max(1, pixels.length / 16);
        if (mean < 10) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (!dataUrl) return;
        capturedRef.current = true;
        onCapturedRef.current?.(dataUrl);
      } catch {
        /* tainted canvas — the paused <video> is still a visible preview */
      }
    };

    const markFrame = () => {
      if (video.videoWidth > 0) setHasFrame(true);
    };

    const seekToPreview = () => {
      try {
        video.currentTime = previewSeekTime(video.duration);
      } catch {
        capture();
        markFrame();
      }
    };

    const kickDecode = () => {
      void video
        .play()
        .then(async () => {
          await waitForDecodedFrame(video);
          markFrame();
          video.pause();
          seekToPreview();
        })
        .catch(() => {
          seekToPreview();
        });
    };

    const onSeeked = () => {
      markFrame();
      capture();
      video.pause();
    };

    const onError = () => {
      setFailed(true);
      releaseRef.current?.();
      releaseRef.current = null;
    };

    video.addEventListener('loadedmetadata', kickDecode);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadeddata', capture);
    video.addEventListener('loadeddata', markFrame);
    video.addEventListener('error', onError);

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      kickDecode();
    }

    return () => {
      video.removeEventListener('loadedmetadata', kickDecode);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadeddata', capture);
      video.removeEventListener('loadeddata', markFrame);
      video.removeEventListener('error', onError);
      video.pause();
    };
  }, [src, mayDecode]);

  const crossOrigin =
    src.includes('videodelivery.net') || src.includes('cloudflarestream.com')
      ? 'anonymous'
      : undefined;

  const placeholder = (
    <div className={`animate-pulse bg-white/10 ${className}`.trim()} aria-hidden />
  );

  if (failed) return placeholder;

  return (
    <>
      {mayDecode ? (
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          crossOrigin={crossOrigin}
          className={`${className} ${hasFrame ? '' : 'opacity-0'}`.trim()}
          aria-hidden
        />
      ) : null}
      {hasFrame ? null : placeholder}
    </>
  );
}
