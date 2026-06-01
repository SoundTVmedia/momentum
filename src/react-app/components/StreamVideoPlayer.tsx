import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';
import type Hls from 'hls.js';
import {
  type ClipPlaybackFields,
  isHlsPlaybackUrl,
  resolveModalPlaybackSource,
} from '@/shared/clip-playback';
import { recordClipView } from '@/react-app/lib/recordClipView';

export type StreamVideoPlayerHandle = {
  togglePlay: () => void;
  toggleMute: () => void;
  play: () => void;
};

export type StreamVideoPlayerPlaybackState = {
  isPlaying: boolean;
  isMuted: boolean;
};

export type StreamVideoPlayerControlsPlacement = 'bottom' | 'top' | 'hidden';

let hlsModulePromise: Promise<typeof Hls> | null = null;

async function loadHlsConstructor(): Promise<typeof Hls> {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js').then((mod) => mod.default);
  }
  return hlsModulePromise;
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
  /** How the video frame fills its box (modal landscape uses `cover` for edge-to-edge width). */
  videoObjectFit?: 'contain' | 'cover';
  /** Where play/mute/fullscreen chrome renders; `hidden` for parent-rendered controls (e.g. clip modal). */
  controlsPlacement?: StreamVideoPlayerControlsPlacement;
  /** Muted-first autoplay (e.g. shared `?clip=` links with no prior user gesture). */
  autoplayMutedFirst?: boolean;
  onPlaybackStateChange?: (state: StreamVideoPlayerPlaybackState) => void;
  /** When set, each play / loop records a view and reports the server total. */
  clipId?: number | null;
  onViewsCountChange?: (viewsCount: number) => void;
}

/**
 * Full clip player: HLS adaptive playback via Cloudflare Stream when available,
 * progressive MP4 / R2 with Range support as fallback.
 */
const StreamVideoPlayer = forwardRef<StreamVideoPlayerHandle, StreamVideoPlayerProps>(
function StreamVideoPlayer(
  {
  stream_video_id,
  stream_playback_url,
  stream_thumbnail_url,
  video_url,
  thumbnail_url,
  streamVideoId,
  playbackUrl,
  fallbackUrl,
  poster,
  autoPlay = false,
  loop = false,
  className = '',
  videoObjectFit = 'contain',
  controlsPlacement = 'bottom',
  autoplayMutedFirst = false,
  onPlaybackStateChange,
  clipId = null,
  onViewsCountChange,
}: StreamVideoPlayerProps,
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const attachedSrcRef = useRef<string | null>(null);
  const lastPlayViewAtRef = useRef(0);
  const lastLoopViewAtRef = useRef(0);
  const lastTimeRef = useRef(0);
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const autoplayMutedFirstRef = useRef(autoplayMutedFirst);
  autoplayMutedFirstRef.current = autoplayMutedFirst;
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(() => Boolean(autoplayMutedFirst && autoPlay));
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    onPlaybackStateChange?.({ isPlaying, isMuted });
  }, [isPlaying, isMuted, onPlaybackStateChange]);

  const clipFields: ClipPlaybackFields = {
    stream_video_id: stream_video_id ?? streamVideoId,
    stream_playback_url: stream_playback_url ?? playbackUrl,
    stream_thumbnail_url,
    video_url: video_url ?? fallbackUrl,
    thumbnail_url,
  };

  const { src: videoSrc, poster: posterSrc, isHls, streamVideoId: streamId } =
    resolveModalPlaybackSource(clipFields);
  const displayPoster = poster || posterSrc || undefined;

  const bumpView = useCallback(async () => {
    if (!clipId) return;
    const count = await recordClipView(clipId);
    if (count != null) onViewsCountChange?.(count);
  }, [clipId, onViewsCountChange]);

  const tryAutoplay = useCallback(() => {
    if (!autoPlayRef.current) return;
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    const attempt = (muted: boolean) => {
      video.muted = muted;
      setIsMuted(muted);
      return video.play();
    };

    const tryUnmute = () => {
      window.setTimeout(() => {
        if (video.paused) return;
        try {
          video.muted = false;
          setIsMuted(false);
        } catch {
          /* ignore */
        }
      }, 280);
    };

    if (autoplayMutedFirstRef.current) {
      void attempt(true).then(tryUnmute).catch(() => {});
      for (const delay of [350, 750]) {
        window.setTimeout(() => {
          if (!video.paused) return;
          void attempt(true).then(tryUnmute).catch(() => {});
        }, delay);
      }
      return;
    }

    void attempt(false).catch(() => {
      void attempt(true)
        .then(() => {
          tryUnmute();
          void video.play().catch(() => {});
        })
        .catch(() => {});
    });
  }, [videoSrc]);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    let cancelled = false;
    setLoadError(false);

    if (attachedSrcRef.current !== videoSrc) {
      setIsLoading(false);
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
        video.src = videoSrc;
        attachedSrcRef.current = videoSrc;
        tryAutoplay();
        return;
      }

      if (useHls) {
        try {
          const Hls = await loadHlsConstructor();
          if (cancelled) return;

          if (Hls.isSupported()) {
            if (hlsRef.current) {
              hlsRef.current.loadSource(videoSrc);
              hlsRef.current.startLoad(0);
              attachedSrcRef.current = videoSrc;
              tryAutoplay();
              return;
            }

            const mobile =
              typeof window !== 'undefined' &&
              window.matchMedia('(max-width: 767px)').matches;
            const hls = new Hls({
              enableWorker: !mobile,
              lowLatencyMode: !mobile,
              maxBufferLength: mobile ? 4 : 8,
              maxMaxBufferLength: mobile ? 10 : 16,
            });
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, tryAutoplay);
            hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean }) => {
              if (data.fatal) {
                console.error('HLS fatal error', data);
                setLoadError(true);
                setIsLoading(false);
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
    };
  }, [videoSrc, isHls, tryAutoplay, destroyHls]);

  useEffect(() => {
    return () => {
      destroyHls();
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      attachedSrcRef.current = null;
    };
  }, [destroyHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      if (clipId) {
        const now = Date.now();
        if (now - lastPlayViewAtRef.current > 350) {
          lastPlayViewAtRef.current = now;
          void bumpView();
        }
      }
    };
    const handleTimeUpdate = () => {
      if (!clipId || !loop) return;
      const d = video.duration;
      const t = video.currentTime;
      if (!Number.isFinite(d) || d <= 0) return;
      const prev = lastTimeRef.current;
      lastTimeRef.current = t;
      if (prev > d * 0.88 && t < 0.4) {
        const now = Date.now();
        if (now - lastLoopViewAtRef.current > 800) {
          lastLoopViewAtRef.current = now;
          void bumpView();
        }
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setLoadError(true);
      setIsLoading(false);
    };
    const handleEnded = () => {
      if (!loop) return;
      video.currentTime = 0;
      void video.play().catch(() => {});
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc, loop, clipId, bumpView]);

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
    if (isPlaying) video.pause();
    else void video.play().catch(() => {});
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else void video.requestFullscreen();
  };

  const play = useCallback(() => {
    tryAutoplay();
  }, [tryAutoplay]);

  useImperativeHandle(ref, () => ({ togglePlay, toggleMute, play }), [isPlaying, play]);

  if (!videoSrc) {
    return (
      <div
        className={`relative bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center ${className}`}
      >
        <p className="text-gray-400">Video not available</p>
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
        muted={isMuted}
        className={`w-full h-full bg-black ${videoObjectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
        preload="auto"
      />

      {isLoading && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <Loader2 className="w-12 h-12 text-momentum-ember animate-spin" />
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-gray-400 text-sm px-4 text-center">Unable to play this video</p>
        </div>
      )}

      {controlsPlacement !== 'hidden' ? (
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
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
