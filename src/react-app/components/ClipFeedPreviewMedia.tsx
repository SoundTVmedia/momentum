import { useEffect, useRef, useState } from 'react';
import {
  type ClipPlaybackFields,
  resolveClipPosterUrl,
  resolveFeedPreviewVideoSrc,
} from '@/shared/clip-playback';

/** True for typical desktop: real hover + mouse/trackpad (not primary touch). */
const HOVER_FINE_POINTER_MQ = '(hover: hover) and (pointer: fine)';
/** Matches Tailwind `md:` — feed cards use scroll autoplay below this width. */
const NARROW_FEED_MQ = '(max-width: 767px)';

export interface ClipFeedPreviewMediaProps extends ClipPlaybackFields {
  /** @deprecated Prefer clip fields; kept for callers passing explicit URLs. */
  playbackUrl?: string | null;
  /** @deprecated Use clip.video_url */
  fallbackUrl?: string;
  /** @deprecated Use clip thumbnail fields */
  posterUrl?: string | null;
  thumbFallback?: string;
  className?: string;
  mediaHovered?: boolean;
}

/**
 * Feed-card preview: poster-only until play is needed, then Stream MP4 (CDN) or R2 URL.
 * Avoids mounting video elements (and HLS) for off-screen tiles.
 */
export default function ClipFeedPreviewMedia({
  stream_video_id,
  stream_playback_url,
  stream_thumbnail_url,
  video_url,
  thumbnail_url,
  playbackUrl,
  fallbackUrl,
  posterUrl,
  thumbFallback = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop',
  className = '',
  mediaHovered: mediaHoveredProp,
}: ClipFeedPreviewMediaProps) {
  const clipFields: ClipPlaybackFields = {
    stream_video_id: stream_video_id ?? undefined,
    stream_playback_url: stream_playback_url ?? playbackUrl,
    stream_thumbnail_url,
    video_url: video_url ?? fallbackUrl,
    thumbnail_url: thumbnail_url ?? posterUrl,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [desktopHoverMode, setDesktopHoverMode] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(HOVER_FINE_POINTER_MQ).matches,
  );
  const [internalHovering, setInternalHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const [ioIntersecting, setIoIntersecting] = useState(false);
  const [ioRatio, setIoRatio] = useState(0);
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_FEED_MQ).matches,
  );
  const [thumbHidden, setThumbHidden] = useState(false);

  const posterSrc = resolveClipPosterUrl(clipFields, posterUrl || thumbFallback);
  const previewVideoSrc = resolveFeedPreviewVideoSrc(clipFields);

  const hoverFromParent = mediaHoveredProp !== undefined;
  const hovering = hoverFromParent ? mediaHoveredProp : internalHovering;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(HOVER_FINE_POINTER_MQ);
    const apply = () => setDesktopHoverMode(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(NARROW_FEED_MQ);
    const apply = () => setIsNarrowViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !previewVideoSrc) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        const r = e.intersectionRatio;
        setIoIntersecting(e.isIntersecting);
        setIoRatio(r);
        setInView(e.isIntersecting && r > 0.06);
      },
      { threshold: [0, 0.06, 0.1, 0.25, 0.35, 0.5, 0.75, 1], rootMargin: '0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [previewVideoSrc]);

  const useHoverPlay = desktopHoverMode && !isNarrowViewport;
  const scrollStyle = isNarrowViewport || !desktopHoverMode;
  const scrollAutoplayThreshold = scrollStyle ? 0.35 : 0.5;
  const scrollPlayOk = ioIntersecting && ioRatio >= scrollAutoplayThreshold;
  const shouldPlay = Boolean(previewVideoSrc) && (useHoverPlay ? hovering && inView : scrollPlayOk);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !previewVideoSrc || !shouldPlay) return;
    void v.play().catch(() => {});
  }, [shouldPlay, previewVideoSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!shouldPlay) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      setThumbHidden(false);
    }
  }, [shouldPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !shouldPlay) return;
    const onPlaying = () => setThumbHidden(true);
    const onPause = () => setThumbHidden(false);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
    };
  }, [shouldPlay, previewVideoSrc]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-black ${className}`.trim()}
      onMouseEnter={hoverFromParent ? undefined : () => setInternalHovering(true)}
      onMouseLeave={hoverFromParent ? undefined : () => setInternalHovering(false)}
    >
      {shouldPlay && previewVideoSrc ? (
        <video
          ref={videoRef}
          src={previewVideoSrc}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : null}
      <img
        src={posterSrc}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover pointer-events-none transition-opacity duration-200 ${
          thumbHidden ? 'opacity-0' : 'opacity-100'
        }`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
