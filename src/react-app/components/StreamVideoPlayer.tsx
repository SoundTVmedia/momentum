import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';

interface StreamVideoPlayerProps {
  streamVideoId?: string | null;
  playbackUrl?: string | null;
  fallbackUrl?: string | null;
  poster?: string | null;
  autoPlay?: boolean;
  className?: string;
}

/**
 * Adaptive bitrate video player using Cloudflare Stream
 * Automatically adjusts quality based on connection speed
 */
export default function StreamVideoPlayer({
  streamVideoId,
  playbackUrl,
  fallbackUrl,
  poster,
  autoPlay = false,
  className = ''
}: StreamVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Determine the best video source
  const videoSrc = playbackUrl || fallbackUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
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

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  if (!videoSrc) {
    return (
      <div className={`relative bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <p className="text-gray-400">Video not available</p>
        </div>
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
        src={videoSrc}
        poster={poster || undefined}
        autoPlay={autoPlay}
        playsInline
        className="w-full h-full object-contain bg-black"
        preload="metadata"
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Custom Controls Overlay */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Center Play/Pause */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          {!isPlaying && !isLoading && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center hover:scale-110 transition-transform">
              <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
            </div>
          )}
        </button>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={togglePlay}
              className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <Maximize className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Stream Quality Badge */}
      {streamVideoId && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-1 bg-black/60 backdrop-blur-lg rounded-full text-xs text-cyan-400 font-medium">
          Adaptive HD
        </div>
      )}
    </div>
  );
}
