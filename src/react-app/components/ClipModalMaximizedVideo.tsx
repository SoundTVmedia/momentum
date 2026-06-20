import { forwardRef, type ReactNode } from 'react';
import StreamVideoPlayer, {
  type StreamVideoPlayerHandle,
  type StreamVideoPlayerPlaybackState,
} from '@/react-app/components/StreamVideoPlayer';
import {
  clipDisplayAspectRatio,
  clipModalPrefersFullWidth,
  clipModalFallbackAspectRatio,
} from '@/react-app/utils/clipDisplayAspectRatio';
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
};

/** Fills the modal player; landscape / 16:9 clips span full width, portrait clips span full height. */
const ClipModalMaximizedVideo = forwardRef<
  StreamVideoPlayerHandle,
  ClipModalMaximizedVideoProps
>(function ClipModalMaximizedVideo(
  { clip, swipeHandlers, overlay, onPlaybackStateChange, onViewsCountChange },
  ref,
) {
  const clipId = clipNumericId(clip);
  const fullWidth = clipModalPrefersFullWidth(clip);
  const ratioStr = clipDisplayAspectRatio(clip) ?? clipModalFallbackAspectRatio(clip);

  return (
    <div
      className="relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden bg-black"
      {...swipeHandlers}
    >
      <div
        className={
          fullWidth
            ? 'relative w-full max-h-full overflow-hidden bg-black'
            : 'relative h-full max-w-full overflow-hidden bg-black'
        }
        style={{ aspectRatio: ratioStr }}
      >
        <StreamVideoPlayer
          ref={ref}
          stream_video_id={clip.stream_video_id}
          stream_playback_url={clip.stream_playback_url}
          stream_thumbnail_url={clip.stream_thumbnail_url}
          video_url={clip.video_url}
          thumbnail_url={clip.thumbnail_url}
          autoPlay
          loop
          controlsPlacement="hidden"
          videoObjectFit="contain"
          onPlaybackStateChange={onPlaybackStateChange}
          clipId={clipId}
          onViewsCountChange={onViewsCountChange}
          className="absolute inset-0 h-full w-full"
        />
        {overlay ? <div className="absolute inset-0 z-10">{overlay}</div> : null}
      </div>
    </div>
  );
});

export default ClipModalMaximizedVideo;
