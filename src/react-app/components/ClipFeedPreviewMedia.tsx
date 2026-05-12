import { useEffect, useRef, useState } from 'react';

/** True for typical desktop: real hover + mouse/trackpad (not primary touch). */
const HOVER_FINE_POINTER_MQ = '(hover: hover) and (pointer: fine)';

export interface ClipFeedPreviewMediaProps {
  playbackUrl?: string | null;
  fallbackUrl: string;
  posterUrl?: string | null;
  thumbFallback?: string;
  className?: string;
  /**
   * When set, desktop (fine-pointer) hover uses this instead of internal mouse handlers
   * so parent overlays can sit above the video without stealing hover.
   */
  mediaHovered?: boolean;
}

/**
 * Feed-card video preview: autoplay when mostly in view on touch / coarse pointers
 * (YouTube-style scroll), and on desktop when the card is hovered and still on-screen.
 * Muted + loop for autoplay policy and feed UX.
 */
export default function ClipFeedPreviewMedia({
  playbackUrl,
  fallbackUrl,
  posterUrl,
  thumbFallback = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop',
  className = '',
  mediaHovered: mediaHoveredProp,
}: ClipFeedPreviewMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [desktopHoverMode, setDesktopHoverMode] = useState(false);
  const [internalHovering, setInternalHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const [mostlyInView, setMostlyInView] = useState(false);
  const [thumbHidden, setThumbHidden] = useState(false);

  const hoverFromParent = mediaHoveredProp !== undefined;
  const hovering = hoverFromParent ? mediaHoveredProp : internalHovering;

  const trimmedPlayback = typeof playbackUrl === 'string' ? playbackUrl.trim() : '';
  const videoSrc = trimmedPlayback || fallbackUrl;
  const thumbSrc = posterUrl || thumbFallback;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(HOVER_FINE_POINTER_MQ);
    const apply = () => setDesktopHoverMode(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !videoSrc) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        const r = e.intersectionRatio;
        setInView(e.isIntersecting && r > 0.06);
        setMostlyInView(e.isIntersecting && r >= 0.5);
      },
      { threshold: [0, 0.06, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [videoSrc]);

  const shouldPlay = desktopHoverMode ? hovering && inView : mostlyInView;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    if (shouldPlay) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [shouldPlay, videoSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlaying = () => setThumbHidden(true);
    const onPause = () => setThumbHidden(false);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
    };
  }, [videoSrc]);

  useEffect(() => {
    setThumbHidden(false);
  }, [videoSrc]);

  if (!videoSrc) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-black ${className}`.trim()}
      onMouseEnter={hoverFromParent ? undefined : () => setInternalHovering(true)}
      onMouseLeave={hoverFromParent ? undefined : () => setInternalHovering(false)}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        muted
        loop
        playsInline
        preload="metadata"
      />
      <img
        src={thumbSrc}
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
