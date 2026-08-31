import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import StreamVideoPlayer, {
  type StreamVideoPlayerHandle,
  type StreamVideoPlayerPlaybackState,
  type StreamVideoPlayerFailure,
} from '@/react-app/components/StreamVideoPlayer';
import { clipPlayerFramePixels, clipPlayerLayout } from '@/react-app/utils/clipDisplayAspectRatio';
import type { ClipWithUser } from '@/shared/types';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';

type ClipModalMaximizedVideoProps = {
  clip: ClipWithUser;
  swipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  overlay?: ReactNode;
  onPlaybackStateChange?: (state: StreamVideoPlayerPlaybackState) => void;
  onViewsCountChange?: (viewsCount: number) => void;
  onPlaybackFailed?: (failure: StreamVideoPlayerFailure) => void;
};

/**
 * Landscape fills the player width; portrait fills the player height.
 * Crop inside that natural ratio when the file or pane doesn't match exactly.
 */
const ClipModalMaximizedVideo = forwardRef<
  StreamVideoPlayerHandle,
  ClipModalMaximizedVideoProps
>(function ClipModalMaximizedVideo(
  { clip, swipeHandlers, overlay, onPlaybackStateChange, onViewsCountChange, onPlaybackFailed },
  ref,
) {
  const clipId = clipNumericId(clip);
  const playerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setMeasured(null);
  }, [clipId, clip.video_url, clip.stream_video_id]);

  useLayoutEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const apply = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width <= 0 || height <= 0) return;
      setPlayerSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = clipPlayerLayout(clip, measured);
  const frame = playerSize ? clipPlayerFramePixels(playerSize, layout) : null;

  return (
    <div
      ref={playerRef}
      className="relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden bg-black"
      {...swipeHandlers}
    >
      <div
        className="relative shrink-0 overflow-hidden bg-black"
        style={
          frame
            ? { width: frame.width, height: frame.height }
            : layout.fillWidth
              ? { width: '100%', height: 'fit-content', aspectRatio: layout.aspectRatio }
              : { height: '100%', width: 'fit-content', aspectRatio: layout.aspectRatio }
        }
      >
        <StreamVideoPlayer
          key={String(clipId ?? clip.video_url ?? clip.stream_video_id ?? 'clip')}
          ref={ref}
          stream_video_id={clip.stream_video_id}
          stream_playback_url={clip.stream_playback_url}
          stream_thumbnail_url={clip.stream_thumbnail_url}
          stream_mp4_url={clip.stream_mp4_url}
          stream_mp4_status={clip.stream_mp4_status}
          video_url={clip.video_url}
          thumbnail_url={clip.thumbnail_url}
          r2_raw_key={clip.r2_raw_key}
          autoPlay
          loop
          controlsPlacement="hidden"
          videoObjectFit="cover"
          onPlaybackStateChange={onPlaybackStateChange}
          onVideoDimensions={setMeasured}
          clipId={clipId}
          onViewsCountChange={onViewsCountChange}
          onPlaybackFailed={onPlaybackFailed}
          showLoadError={false}
          className="absolute inset-0 h-full w-full"
        />
        {overlay ? <div className="absolute inset-0 z-10">{overlay}</div> : null}
      </div>
    </div>
  );
});

export default ClipModalMaximizedVideo;
