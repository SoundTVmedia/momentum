import { useEffect, useRef, useState } from 'react';
import {
  type ClipPlaybackFields,
  DEFAULT_CLIP_POSTER_FALLBACK,
  prefetchFeedPreviewMp4,
  resolveFeedPreviewVideoSrc,
} from '@/shared/clip-playback';
import { useClipPosterSrc } from '@/react-app/lib/clipPosterImage';
import {
  clearFeedPreviewPlayback,
  releaseFeedPreviewPlay,
  requestFeedPreviewPlay,
} from '@/react-app/lib/feedVideoPlaybackLimiter';

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
  /** Stable key for limiting concurrent mobile feed decoders (e.g. clip id). */
  previewInstanceKey?: string;
  /** Static poster only — skip video prefetch/autoplay (uploading clips). */
  posterOnly?: boolean;
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
  thumbFallback = DEFAULT_CLIP_POSTER_FALLBACK,
  className = '',
  mediaHovered: mediaHoveredProp,
  previewInstanceKey = '',
  posterOnly = false,
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

  const { src: displayPoster, onError: onPosterError, onLoad: onPosterLoad, crossOrigin } =
    useClipPosterSrc(clipFields, posterUrl || thumbFallback);
  const previewVideoSrc = posterOnly ? null : resolveFeedPreviewVideoSrc(clipFields);

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
    if (inView && previewVideoSrc) {
      prefetchFeedPreviewMp4(previewVideoSrc);
    }
  }, [inView, previewVideoSrc]);

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
  const playKey = previewInstanceKey || previewVideoSrc || '';
  const wantsPlay =
    Boolean(previewVideoSrc) && (useHoverPlay ? hovering && inView : scrollPlayOk);
  const [allowedPlay, setAllowedPlay] = useState(false);

  useEffect(() => {
    if (!wantsPlay || !playKey) {
      setAllowedPlay(false);
      if (playKey) releaseFeedPreviewPlay(playKey);
      return;
    }
    setAllowedPlay(requestFeedPreviewPlay(playKey));
    return () => releaseFeedPreviewPlay(playKey);
  }, [wantsPlay, playKey]);

  const shouldPlay = wantsPlay && (playKey ? allowedPlay : true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !previewVideoSrc || !shouldPlay) return;
    void v.play().catch(() => {});
  }, [shouldPlay, previewVideoSrc]);

  /** Always restore poster when preview stops — video ref is often null after unmount. */
  useEffect(() => {
    if (!shouldPlay) {
      setThumbHidden(false);
    }
  }, [shouldPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || shouldPlay) return;
    v.pause();
    v.removeAttribute('src');
    v.load();
    if (playKey) releaseFeedPreviewPlay(playKey);
  }, [shouldPlay, playKey]);

  useEffect(() => {
    if (!playKey) return;
    return () => releaseFeedPreviewPlay(playKey);
  }, [playKey]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const v = videoRef.current;
        if (v) {
          v.pause();
          v.removeAttribute('src');
          v.load();
        }
        setThumbHidden(false);
        clearFeedPreviewPlayback();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !shouldPlay) return;

    const revealVideoIfReady = () => {
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setThumbHidden(true);
      }
    };

    const onPause = () => setThumbHidden(false);
    const onError = () => setThumbHidden(false);

    v.addEventListener('loadeddata', revealVideoIfReady);
    v.addEventListener('playing', revealVideoIfReady);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('loadeddata', revealVideoIfReady);
      v.removeEventListener('playing', revealVideoIfReady);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
    };
  }, [shouldPlay, previewVideoSrc]);

  return (
    <div
      ref={containerRef}
      className={`clip-feed-preview absolute inset-0 overflow-hidden bg-black rounded-[inherit] ${className}`.trim()}
      onMouseEnter={hoverFromParent ? undefined : () => setInternalHovering(true)}
      onMouseLeave={hoverFromParent ? undefined : () => setInternalHovering(false)}
    >
      {shouldPlay && previewVideoSrc ? (
        <video
          ref={videoRef}
          src={previewVideoSrc}
          className={`clip-feed-preview__video absolute inset-0 z-[1] h-full w-full object-cover pointer-events-none rounded-[inherit] transition-opacity duration-200 ${
            thumbHidden ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          loop
          playsInline
          preload={shouldPlay ? 'auto' : 'metadata'}
        />
      ) : null}
      <img
        key={displayPoster}
        src={displayPoster}
        alt=""
        crossOrigin={crossOrigin}
        className={`clip-feed-preview__poster absolute inset-0 z-[2] h-full w-full object-cover pointer-events-none rounded-[inherit] transition-opacity duration-200 ${
          thumbHidden ? 'opacity-0' : 'opacity-100'
        }`}
        loading={posterOnly ? 'eager' : 'lazy'}
        fetchPriority={posterOnly ? 'high' : 'auto'}
        decoding="async"
        onError={onPosterError}
        onLoad={onPosterLoad}
      />
    </div>
  );
}
