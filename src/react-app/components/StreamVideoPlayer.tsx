import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';
import {
  type ClipPlaybackFields,
  isHlsPlaybackUrl,
  resolveModalPlaybackSource,
} from '@/shared/clip-playback';

export type StreamVideoPlayerHandle = {
  togglePlay: () => void;
  toggleMute: () => void;
};

export type StreamVideoPlayerPlaybackState = {
  isPlaying: boolean;
  isMuted: boolean;
};

export type StreamVideoPlayerControlsPlacement = 'bottom' | 'top' | 'hidden';

interface StreamVideoPlayerProps extends ClipPlaybackFields {
  /** @deprecated Pass clip fields or use playbackUrl with stream_video_id */
  streamVideoId?: string | null;
  playbackUrl?: string | null;
  fallbackUrl?: string | null;
  poster?: string | null;
  autoPlay?: boolean;
  className?: string;
  /** Where play/mute/fullscreen chrome renders; `hidden` for parent-rendered controls (e.g. clip modal). */
  controlsPlacement?: StreamVideoPlayerControlsPlacement;
  onPlaybackStateChange?: (state: StreamVideoPlayerPlaybackState) => void;
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
  className = '',
  controlsPlacement = 'bottom',
  onPlaybackStateChange,
}: StreamVideoPlayerProps,
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    let cancelled = false;
    setLoadError(false);
    setIsLoading(true);

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };

    const attachNative = (url: string) => {
      video.src = url;
    };

    const setup = async () => {
      cleanup();

      if (isHls && isHlsPlaybackUrl(videoSrc)) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          attachNative(videoSrc);
          return;
        }

        try {
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(videoSrc);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data.fatal) {
                console.error('HLS fatal error', data);
                setLoadError(true);
                setIsLoading(false);
              }
            });
            hlsRef.current = hls;
            return;
          }
        } catch (e) {
          console.error('Failed to load hls.js', e);
        }
      }

      attachNative(videoSrc);
    };

    void setup();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [videoSrc, isHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setLoadError(true);
      setIsLoading(false);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [videoSrc]);

  useEffect(() => {
    if (!autoPlay) return;
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    void video.play().catch(() => {});
  }, [autoPlay, videoSrc]);

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

  useImperativeHandle(ref, () => ({ togglePlay, toggleMute }), [isPlaying]);

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
        playsInline
        className="w-full h-full object-contain bg-black"
        preload="auto"
      />

      {isLoading && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-12 h-12 text-momentum-teal animate-spin" />
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-gray-400 text-sm px-4 text-center">Unable to play this video</p>
        </div>
      )}

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

        {controlsPlacement !== 'hidden' ? (
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
        ) : null}
      </div>

      {streamId && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-1 bg-black/60 backdrop-blur-lg rounded-full text-xs text-momentum-teal font-medium">
          Adaptive HD
        </div>
      )}
    </div>
  );
});

export default StreamVideoPlayer;
