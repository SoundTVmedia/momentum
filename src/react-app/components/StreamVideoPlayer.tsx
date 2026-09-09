import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';
import type Hls from 'hls.js';
import {
  type ClipPlaybackFields,
  isHlsPlaybackUrl,
  NATIVE_HLS_START_MBPS,
  resolveModalPlaybackSource,
  stripStreamBandwidthHint,
  withStreamBandwidthHint,
} from '@/shared/clip-playback';
import { recordClipView } from '@/react-app/lib/recordClipView';
import {
  markPlaybackSessionFast,
  releaseWarmedDecoder,
  resolvePrefetchedPlaybackSrc,
} from '@/react-app/lib/clipPlaybackPrefetch';
import { reportClipPlaybackTelemetry } from '@/react-app/lib/clipPlaybackTelemetry';
import {
  classifyPlaybackRendition,
  truncatePlaybackUrl,
} from '@/shared/clip-playback-telemetry';
import { tryVideoPlayPreferSound, playVideoWithSoundOnGesture } from '@/react-app/utils/videoAutoplay';
import { restoreNativeMediaPlaybackAudio, shouldUseNativeIosCapture } from '@/react-app/lib/native-capture';
import {
  enterClipPictureInPicture,
  exitClipPictureInPicture,
  isVideoInPictureInPicture,
} from '@/react-app/lib/clip-picture-in-picture';

export type StreamVideoPlayerHandle = {
  togglePlay: () => void;
  toggleMute: () => void;
  play: () => void;
  /** Halt decode and audio immediately (modal close). */
  stop: () => void;
  enterPictureInPicture: () => Promise<boolean>;
};

/** Pause clip modal, feed-preview, and prefetch videos so audio cannot leak after close. */
export function stopAllClipMediaElements(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('video').forEach((node) => {
    if (!(node instanceof HTMLVideoElement)) return;
    const inModal = node.closest(
      '.clip-player-lock-scale, .glass-dropdown, .glass-modal-overlay',
    );
    const inPreview = node.closest('.clip-feed-preview');
    const inPrefetch = node.closest('#clip-playback-prefetch-host');
    if (!inModal && !inPreview && !inPrefetch) return;
    if (isVideoInPictureInPicture(node)) return;
    try {
      node.pause();
      node.muted = true;
      node.defaultMuted = true;
    } catch {
      /* ignore */
    }
  });
}

function hardStopVideoElement(video: HTMLVideoElement | null): void {
  if (!video) return;
  try {
    video.autoplay = false;
    video.pause();
    video.muted = true;
    video.defaultMuted = true;
    video.removeAttribute('src');
    video.src = '';
    video.srcObject = null;
    video.load();
  } catch {
    /* already detached */
  }
}

export type StreamVideoPlayerPlaybackState = {
  isPlaying: boolean;
  isMuted: boolean;
};

export type StreamVideoPlayerControlsPlacement = 'bottom' | 'top' | 'hidden';

export type StreamVideoPlayerFailure = {
  clipId: number;
  mediaErrorCode: number | null;
};

let hlsModulePromise: Promise<typeof Hls> | null = null;

async function loadHlsConstructor(): Promise<typeof Hls> {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js').then((mod) => mod.default);
  }
  return hlsModulePromise;
}

/** Preload hls.js on non-Safari browsers (Safari uses native HLS). */
export function warmHlsPlaybackModule(): void {
  if (typeof navigator === 'undefined') return;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  if (ios || safari) return;
  void loadHlsConstructor();
}

interface StreamVideoPlayerProps extends ClipPlaybackFields {
  /** @deprecated Pass clip fields or use playbackUrl with stream_video_id */
  streamVideoId?: string | null;
  playbackUrl?: string | null;
  fallbackUrl?: string | null;
  poster?: string | null;
  autoPlay?: boolean;
  /** When true, restart from the beginning when playback reaches the end. */
  loop?: boolean;
  className?: string;
  /** Crop inside the sized player frame (landscape = full width, portrait = full height). */
  videoObjectFit?: 'contain' | 'cover';
  /** Where play/mute/fullscreen chrome renders; `hidden` for parent-rendered controls (e.g. clip modal). */
  controlsPlacement?: StreamVideoPlayerControlsPlacement;
  onPlaybackStateChange?: (state: StreamVideoPlayerPlaybackState) => void;
  /** Intrinsic decoded size — used to size the modal to 16:9 width vs 9:16 height. */
  onVideoDimensions?: (size: { width: number; height: number }) => void;
  /** When set, each play / loop records a view and reports the server total. */
  clipId?: number | null;
  onViewsCountChange?: (viewsCount: number) => void;
  /** Fired once after MP4, HLS, and R2 sources all fail. */
  onPlaybackFailed?: (failure: StreamVideoPlayerFailure) => void;
  /** When false, keep a loader instead of the unplayable copy (clip modal uses its own overlay). */
  showLoadError?: boolean;
}

/**
 * Full clip player: Stream HLS first (low start rung, ABR climbs), then Stream MP4, then R2.
 */
const StreamVideoPlayer = forwardRef<StreamVideoPlayerHandle, StreamVideoPlayerProps>(
function StreamVideoPlayer(
  {
  stream_video_id,
  stream_playback_url,
  stream_thumbnail_url,
  stream_mp4_url,
  stream_mp4_status,
  video_url,
  thumbnail_url,
  r2_raw_key,
  video_duration,
  streamVideoId,
  playbackUrl,
  fallbackUrl,
  poster,
  autoPlay = false,
  loop = false,
  className = '',
  videoObjectFit = 'contain',
  controlsPlacement = 'bottom',
  onPlaybackStateChange,
  onVideoDimensions,
  clipId = null,
  onViewsCountChange,
  onPlaybackFailed,
  showLoadError = true,
}: StreamVideoPlayerProps,
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const attachedSrcRef = useRef<string | null>(null);
  const lastPlayViewAtRef = useRef(0);
  const lastLoopViewAtRef = useRef(0);
  const lastTimeRef = useRef(0);
  const loadStartedAtRef = useRef(0);
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  /** When set, user explicitly chose mute state — autoplay/loop must not override it. */
  const userMutePreferenceRef = useRef<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const stoppedRef = useRef(false);
  const onVideoDimensionsRef = useRef(onVideoDimensions);
  onVideoDimensionsRef.current = onVideoDimensions;

  useEffect(() => {
    onPlaybackStateChange?.({ isPlaying, isMuted });
  }, [isPlaying, isMuted, onPlaybackStateChange]);

  const clipFields: ClipPlaybackFields = useMemo(
    () => ({
      stream_video_id: stream_video_id ?? streamVideoId,
      stream_playback_url: stream_playback_url ?? playbackUrl,
      stream_thumbnail_url,
      stream_mp4_url,
      stream_mp4_status,
      video_url: video_url ?? fallbackUrl,
      thumbnail_url,
      r2_raw_key,
      video_duration,
    }),
    [
      stream_video_id,
      streamVideoId,
      stream_playback_url,
      playbackUrl,
      stream_thumbnail_url,
      stream_mp4_url,
      stream_mp4_status,
      video_url,
      fallbackUrl,
      thumbnail_url,
      r2_raw_key,
      video_duration,
    ],
  );

  const resolvedModal = resolveModalPlaybackSource(clipFields);
  const networkSrc = resolvedModal.src;
  const [playbackSrc, setPlaybackSrc] = useState(() => resolvePrefetchedPlaybackSrc(networkSrc));
  const [playbackIsHls, setPlaybackIsHls] = useState(
    resolvedModal.isHls && isHlsPlaybackUrl(resolvePrefetchedPlaybackSrc(networkSrc)),
  );
  const hlsFallbackRef = useRef(resolvedModal.hlsFallbackSrc ?? null);
  const hlsFallbackUsedRef = useRef(false);
  const mp4FallbackRef = useRef(resolvedModal.mp4FallbackSrc ?? null);
  const mp4FallbackUsedRef = useRef(false);
  const r2FallbackRef = useRef(resolvedModal.r2FallbackSrc ?? null);
  const r2FallbackUsedRef = useRef(false);
  const reportedFailureRef = useRef(false);
  const stallRetryUsedRef = useRef(false);
  const firstFrameAtRef = useRef(0);
  const stallCountRef = useRef(0);
  const rebufferMsRef = useRef(0);
  const stallStartedAtRef = useRef(0);
  const renditionRef = useRef('unknown');
  const durationSecRef = useRef(0);
  const telemetryFlushedRef = useRef(false);
  const sessionClipIdRef = useRef<number | null>(null);
  const abrPromotedRef = useRef(false);
  const promotingAbrRef = useRef(false);
  const onPlaybackFailedRef = useRef(onPlaybackFailed);
  onPlaybackFailedRef.current = onPlaybackFailed;
  const tryNextFallbackRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    const next = resolveModalPlaybackSource(clipFields);
    const src = resolvePrefetchedPlaybackSrc(next.src);
    setPlaybackSrc(src);
    setPlaybackIsHls(next.isHls && isHlsPlaybackUrl(src));
    hlsFallbackRef.current = next.hlsFallbackSrc ?? null;
    hlsFallbackUsedRef.current = false;
    mp4FallbackRef.current = next.mp4FallbackSrc ?? null;
    mp4FallbackUsedRef.current = false;
    r2FallbackRef.current = next.r2FallbackSrc ?? null;
    r2FallbackUsedRef.current = false;
    reportedFailureRef.current = false;
    stallRetryUsedRef.current = false;
    abrPromotedRef.current = false;
    promotingAbrRef.current = false;
    setLoadError(false);
    setFirstFrameReady(false);
    attachedSrcRef.current = null;
  }, [clipFields]);

  const videoSrc = playbackSrc;
  const isHls = playbackIsHls;
  const { poster: posterSrc, streamVideoId: streamId } = resolvedModal;
  const displayPoster = poster || posterSrc || undefined;

  const bumpView = useCallback(async () => {
    if (!clipId) return;
    const count = await recordClipView(clipId);
    if (count != null) onViewsCountChange?.(count);
  }, [clipId, onViewsCountChange]);

  const resolveAutoplayMuted = useCallback((): boolean => {
    if (userMutePreferenceRef.current !== null) return userMutePreferenceRef.current;
    return false;
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const tryHlsFallback = useCallback(() => {
    const fallback = hlsFallbackRef.current;
    if (!fallback || hlsFallbackUsedRef.current) return false;
    hlsFallbackUsedRef.current = true;
    attachedSrcRef.current = null;
    destroyHls();
    setLoadError(false);
    setIsLoading(true);
    setFirstFrameReady(false);
    setPlaybackSrc(fallback);
    setPlaybackIsHls(true);
    return true;
  }, [destroyHls]);

  const tryMp4Fallback = useCallback(() => {
    const fallback = mp4FallbackRef.current;
    if (!fallback || mp4FallbackUsedRef.current) return false;
    mp4FallbackUsedRef.current = true;
    attachedSrcRef.current = null;
    destroyHls();
    setLoadError(false);
    setIsLoading(true);
    setFirstFrameReady(false);
    setPlaybackSrc(fallback);
    setPlaybackIsHls(false);
    return true;
  }, [destroyHls]);

  const tryR2Fallback = useCallback(() => {
    const fallback = r2FallbackRef.current;
    if (!fallback || r2FallbackUsedRef.current) return false;
    r2FallbackUsedRef.current = true;
    attachedSrcRef.current = null;
    destroyHls();
    setLoadError(false);
    setIsLoading(true);
    setFirstFrameReady(false);
    setPlaybackSrc(fallback);
    setPlaybackIsHls(false);
    return true;
  }, [destroyHls]);

  const reportPlaybackFailed = useCallback(
    (mediaErrorCode: number | null) => {
      if (reportedFailureRef.current || !clipId) return;
      reportedFailureRef.current = true;
      onPlaybackFailedRef.current?.({ clipId, mediaErrorCode });
    },
    [clipId],
  );

  tryNextFallbackRef.current = () => {
    if (tryHlsFallback()) return true;
    if (tryMp4Fallback()) return true;
    if (tryR2Fallback()) return true;
    return false;
  };

  const recoverStallOnce = useCallback((): boolean => {
    if (stallRetryUsedRef.current) return false;
    stallRetryUsedRef.current = true;
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (hls) {
      try {
        hls.recoverMediaError();
      } catch {
        try {
          hls.startLoad();
        } catch {
          /* ignore */
        }
      }
      return true;
    }
    if (video && videoSrc) {
      const t = video.currentTime;
      try {
        if (Number.isFinite(t) && t > 0.2) video.currentTime = t;
        void video.play().catch(() => {});
      } catch {
        /* ignore */
      }
      return true;
    }
    return false;
  }, [videoSrc]);

  const flushTelemetry = useCallback(() => {
    if (telemetryFlushedRef.current) return;
    const id = sessionClipIdRef.current;
    const ttff = firstFrameAtRef.current;
    if (!id || ttff <= 0) return;
    telemetryFlushedRef.current = true;
    if (stallStartedAtRef.current > 0) {
      rebufferMsRef.current += Math.max(0, Date.now() - stallStartedAtRef.current);
      stallStartedAtRef.current = 0;
    }
    const storedDur =
      typeof video_duration === 'number' && Number.isFinite(video_duration) && video_duration > 0
        ? video_duration
        : 0;
    reportClipPlaybackTelemetry({
      id,
      ttff,
      stalls: stallCountRef.current,
      rebuf: rebufferMsRef.current,
      url: truncatePlaybackUrl(videoSrc || networkSrc || ''),
      rend: renditionRef.current,
      dur: durationSecRef.current > 0 ? durationSecRef.current : storedDur,
    });
  }, [networkSrc, videoSrc, video_duration]);
  const flushTelemetryRef = useRef(flushTelemetry);
  flushTelemetryRef.current = flushTelemetry;

  const playbackAudioRestore = useCallback(async () => {
    if (shouldUseNativeIosCapture()) {
      await restoreNativeMediaPlaybackAudio();
    }
  }, []);

  const tryAutoplay = useCallback(() => {
    if (stoppedRef.current) return;
    if (!autoPlayRef.current) return;
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (!video.paused) return;

    tryVideoPlayPreferSound(video, {
      preferMuted: resolveAutoplayMuted(),
      onMutedChange: setIsMuted,
      restoreAudioSession: playbackAudioRestore,
    });
  }, [videoSrc, resolveAutoplayMuted, playbackAudioRestore]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    let cancelled = false;
    setLoadError(false);

    if (attachedSrcRef.current !== videoSrc) {
      setIsLoading(true);
      setFirstFrameReady(false);
      loadStartedAtRef.current = Date.now();
      firstFrameAtRef.current = 0;
      stallCountRef.current = 0;
      rebufferMsRef.current = 0;
      stallStartedAtRef.current = 0;
      telemetryFlushedRef.current = false;
      stallRetryUsedRef.current = false;
      abrPromotedRef.current = false;
      promotingAbrRef.current = false;
      sessionClipIdRef.current = clipId;
      renditionRef.current = classifyPlaybackRendition(videoSrc, null);
      durationSecRef.current =
        typeof video_duration === 'number' && Number.isFinite(video_duration) && video_duration > 0
          ? video_duration
          : 0;
    }

    const setup = async () => {
      if (cancelled) return;
      if (attachedSrcRef.current === videoSrc) {
        tryAutoplay();
        return;
      }

      const useHls = isHls && isHlsPlaybackUrl(videoSrc);

      if (useHls && video.canPlayType('application/vnd.apple.mpegurl')) {
        destroyHls();
        const startSrc = withStreamBandwidthHint(videoSrc, NATIVE_HLS_START_MBPS);
        video.src = startSrc;
        attachedSrcRef.current = videoSrc;
        renditionRef.current = 'hls:hint';
        tryAutoplay();
        return;
      }

      if (useHls) {
        try {
          const Hls = await loadHlsConstructor();
          if (cancelled) return;

          if (Hls.isSupported()) {
            destroyHls();
            const mobile =
              typeof window !== 'undefined' &&
              window.matchMedia('(max-width: 767px)').matches;
            const hls = new Hls({
              enableWorker: !mobile,
              lowLatencyMode: false,
              startLevel: 0,
              abrEwmaDefaultEstimate: 500_000,
              maxBufferLength: 4,
              maxMaxBufferLength: 8,
              maxBufferSize: 6 * 1000 * 1000,
              capLevelToPlayerSize: true,
              startFragPrefetch: true,
            });
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled || stoppedRef.current) return;
              const start = hls.levels[hls.currentLevel] ?? hls.levels[0];
              if (start?.height) {
                renditionRef.current = classifyPlaybackRendition(videoSrc, start.height);
              }
              tryAutoplay();
            });
            hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean }) => {
              if (data.fatal) {
                console.error('HLS fatal error', data);
                if (tryNextFallbackRef.current()) return;
                const code = videoRef.current?.error?.code ?? 4;
                setLoadError(true);
                setIsLoading(false);
                reportPlaybackFailed(code);
              }
            });
            hls.loadSource(videoSrc);
            hlsRef.current = hls;
            attachedSrcRef.current = videoSrc;
            tryAutoplay();
            return;
          }
        } catch (e) {
          console.error('Failed to load hls.js', e);
        }
      }

      destroyHls();
      video.src = videoSrc;
      attachedSrcRef.current = videoSrc;
      tryAutoplay();
    };

    void setup();

    return () => {
      cancelled = true;
      flushTelemetryRef.current();
      destroyHls();
      hardStopVideoElement(video);
      attachedSrcRef.current = null;
    };
  }, [videoSrc, isHls, tryAutoplay, destroyHls, reportPlaybackFailed, video_duration, clipId]);

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
      flushTelemetryRef.current();
      destroyHls();
      hardStopVideoElement(videoRef.current);
      attachedSrcRef.current = null;
    };
  }, [destroyHls]);

  useEffect(() => {
    userMutePreferenceRef.current = null;
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reportDimensions = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) onVideoDimensionsRef.current?.({ width: w, height: h });
    };
    const tryPromoteNativeAbr = () => {
      if (abrPromotedRef.current || promotingAbrRef.current || stoppedRef.current) return;
      if (firstFrameAtRef.current <= 0) return;
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
      if (!isHls || !isHlsPlaybackUrl(videoSrc)) return;
      if (!video.canPlayType('application/vnd.apple.mpegurl')) return;
      const live = video.currentSrc || video.src || '';
      if (!live.toLowerCase().includes('clientbandwidthhint')) return;
      const full = stripStreamBandwidthHint(videoSrc);
      const hinted = withStreamBandwidthHint(videoSrc, NATIVE_HLS_START_MBPS);
      if (!full || full === hinted) return;

      abrPromotedRef.current = true;
      promotingAbrRef.current = true;
      const t = video.currentTime;
      const keepMuted = video.muted;
      video.src = full;
      try {
        if (Number.isFinite(t) && t > 0.05) video.currentTime = t;
      } catch {
        /* Safari may reject until metadata */
      }
      video.muted = keepMuted;
      void video
        .play()
        .catch(() => {
          promotingAbrRef.current = false;
          video.src = hinted;
          void video.play().catch(() => {});
        })
        .then(() => {
          promotingAbrRef.current = false;
        });
    };
    const markFirstFrame = () => {
      if (promotingAbrRef.current) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      setFirstFrameReady(true);
      if (firstFrameAtRef.current <= 0 && loadStartedAtRef.current > 0) {
        firstFrameAtRef.current = Math.max(0, Date.now() - loadStartedAtRef.current);
        if (firstFrameAtRef.current < 1500) markPlaybackSessionFast();
      }
      if (Number.isFinite(video.duration) && video.duration > 0) {
        durationSecRef.current = video.duration;
      }
      releaseWarmedDecoder(networkSrc);
      releaseWarmedDecoder(withStreamBandwidthHint(networkSrc, NATIVE_HLS_START_MBPS));
      if (stallStartedAtRef.current > 0) {
        rebufferMsRef.current += Math.max(0, Date.now() - stallStartedAtRef.current);
        stallStartedAtRef.current = 0;
      }
      tryPromoteNativeAbr();
    };
    const handlePlay = () => {
      setIsPlaying(true);
      markFirstFrame();
      if (clipId && !promotingAbrRef.current) {
        const now = Date.now();
        if (now - lastPlayViewAtRef.current > 350) {
          lastPlayViewAtRef.current = now;
          void bumpView();
        }
      }
    };
    const handleTimeUpdate = () => {
      const d = video.duration;
      const t = video.currentTime;
      if (!Number.isFinite(d) || d <= 0) return;
      durationSecRef.current = d;
      const prev = lastTimeRef.current;
      lastTimeRef.current = t;
      tryPromoteNativeAbr();

      if (loop && prev > d * 0.88 && t < 0.4) {
        const keepMuted = userMutePreferenceRef.current ?? video.muted;
        if (video.muted !== keepMuted) {
          video.muted = keepMuted;
          setIsMuted(keepMuted);
        }
      }

      if (!clipId || !loop) return;
      if (prev > d * 0.88 && t < 0.4) {
        const now = Date.now();
        if (now - lastLoopViewAtRef.current > 800) {
          lastLoopViewAtRef.current = now;
          void bumpView();
        }
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => {
      if (promotingAbrRef.current) return;
      setIsLoading(true);
      if (firstFrameAtRef.current > 0 && stallStartedAtRef.current <= 0) {
        stallStartedAtRef.current = Date.now();
        stallCountRef.current += 1;
      }
    };
    const handleCanPlay = () => {
      markFirstFrame();
    };
    const handleError = () => {
      if (promotingAbrRef.current) {
        promotingAbrRef.current = false;
        video.src = withStreamBandwidthHint(videoSrc, NATIVE_HLS_START_MBPS);
        void video.play().catch(() => {});
        return;
      }
      if (tryNextFallbackRef.current()) return;
      const code = video.error?.code ?? 4;
      setLoadError(true);
      setIsLoading(false);
      reportPlaybackFailed(Number.isFinite(code) ? code : 4);
    };
    const handleEnded = () => {
      if (!loop) return;
      const keepMuted = userMutePreferenceRef.current ?? video.muted;
      video.muted = keepMuted;
      setIsMuted(keepMuted);
      video.currentTime = 0;
      void video.play().catch(() => {});
    };

    video.addEventListener('loadedmetadata', reportDimensions);
    video.addEventListener('loadeddata', reportDimensions);
    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', reportDimensions);
      video.removeEventListener('loadeddata', reportDimensions);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc, loop, clipId, bumpView, reportPlaybackFailed, networkSrc, isHls]);

  useEffect(() => {
    if (!videoSrc || loadError) return;
    const timeout = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (recoverStallOnce()) return;
      if (tryNextFallbackRef.current()) return;
      const code = video.error?.code ?? 4;
      setLoadError(true);
      setIsLoading(false);
      reportPlaybackFailed(Number.isFinite(code) ? code : 4);
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [videoSrc, loadError, reportPlaybackFailed, recoverStallOnce]);

  useEffect(() => {
    if (!videoSrc || loadError) return;
    let timer: number | null = null;
    const onWaiting = () => {
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        const video = videoRef.current;
        if (promotingAbrRef.current) return;
        if (!video || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
        if (video.paused && firstFrameAtRef.current > 0) return;
        recoverStallOnce();
      }, 2500);
    };
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener('waiting', onWaiting);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      video.removeEventListener('waiting', onWaiting);
    };
  }, [videoSrc, loadError, recoverStallOnce]);

  useEffect(() => {
    if (videoSrc) return;
    setLoadError(true);
    setIsLoading(false);
    reportPlaybackFailed(4);
  }, [videoSrc, reportPlaybackFailed]);

  useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    tryAutoplay();
    video.addEventListener('canplay', tryAutoplay);
    video.addEventListener('loadeddata', tryAutoplay);
    return () => {
      video.removeEventListener('canplay', tryAutoplay);
      video.removeEventListener('loadeddata', tryAutoplay);
    };
  }, [autoPlay, videoSrc, tryAutoplay]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      return;
    }
    if (isMuted) {
      void video.play().catch(() => {});
      return;
    }
    void playVideoWithSoundOnGesture(video, {
      onMutedChange: setIsMuted,
      restoreAudioSession: playbackAudioRestore,
    });
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    userMutePreferenceRef.current = nextMuted;
    if (nextMuted) {
      video.muted = true;
      setIsMuted(true);
      return;
    }
    void playVideoWithSoundOnGesture(video, {
      onMutedChange: (muted) => {
        setIsMuted(muted);
        userMutePreferenceRef.current = muted;
      },
      restoreAudioSession: playbackAudioRestore,
    });
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else void video.requestFullscreen();
  };

  const play = useCallback(() => {
    stoppedRef.current = false;
    autoPlayRef.current = true;
    tryAutoplay();
  }, [tryAutoplay]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    autoPlayRef.current = false;
    flushTelemetryRef.current();
    void exitClipPictureInPicture(videoRef.current);
    destroyHls();
    hardStopVideoElement(videoRef.current);
    attachedSrcRef.current = null;
    setIsPlaying(false);
  }, [destroyHls]);

  const enterPictureInPicture = useCallback(async () => {
    stoppedRef.current = false;
    autoPlayRef.current = true;
    return enterClipPictureInPicture(videoRef.current);
  }, []);

  useImperativeHandle(ref, () => ({ togglePlay, toggleMute, play, stop, enterPictureInPicture }), [
    isPlaying,
    play,
    stop,
    enterPictureInPicture,
  ]);

  if (!videoSrc) {
    return (
      <div
        className={`relative bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center ${className}`}
      >
        {showLoadError ? (
          <p className="text-gray-400 text-sm px-4 text-center">This clip can&apos;t be played</p>
        ) : (
          <Loader2 className="w-12 h-12 text-momentum-ember animate-spin" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        poster={displayPoster}
        autoPlay={autoPlay}
        loop={loop}
        playsInline
        disablePictureInPicture={false}
        muted={isMuted}
        className={`absolute inset-0 h-full w-full bg-black ${videoObjectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
        preload="auto"
      />

      {displayPoster && !firstFrameReady && !loadError ? (
        <img
          src={displayPoster}
          alt=""
          className={`absolute inset-0 z-[1] h-full w-full pointer-events-none ${
            videoObjectFit === 'cover' ? 'object-cover' : 'object-contain'
          }`}
          decoding="async"
          fetchPriority="high"
        />
      ) : null}

      {isLoading && !loadError && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-white/80 animate-spin drop-shadow" />
        </div>
      )}

      {loadError && showLoadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-gray-400 text-sm px-4 text-center">This clip can&apos;t be played</p>
        </div>
      ) : null}

      {loadError && !showLoadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <Loader2 className="w-12 h-12 text-momentum-ember animate-spin" />
        </div>
      ) : null}

      {controlsPlacement !== 'hidden' ? (
        <div
          className={`absolute inset-0 z-[3] transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            {!isPlaying && !isLoading && !loadError && (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
              </div>
            )}
          </button>

          <div
            className={`absolute left-0 right-0 flex items-center justify-between p-3 sm:p-4 ${
              controlsPlacement === 'top' ? 'top-0' : 'bottom-0'
            }`}
          >
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                type="button"
                onClick={togglePlay}
                className="rounded-full p-1.5 transition-colors hover:bg-white/20 sm:p-2"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                ) : (
                  <Play className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full p-1.5 transition-colors hover:bg-white/20 sm:p-2"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                ) : (
                  <Volume2 className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-full p-1.5 transition-colors hover:bg-white/20 sm:p-2"
              aria-label="Fullscreen"
            >
              <Maximize className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>
      ) : null}

      {streamId && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-1 bg-black/60 backdrop-blur-lg rounded-full text-xs text-momentum-ember font-medium">
          Adaptive HD
        </div>
      )}
    </div>
  );
});

export default StreamVideoPlayer;
