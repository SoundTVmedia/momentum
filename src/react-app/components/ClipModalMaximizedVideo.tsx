import { forwardRef, type ReactNode } from 'react';
import StreamVideoPlayer, {
  type StreamVideoPlayerHandle,
  type StreamVideoPlayerPlaybackState,
  type StreamVideoPlayerFailure,
} from '@/react-app/components/StreamVideoPlayer';
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

/** Fills the modal player edge-to-edge (crop, no letterbox), matching feed tiles. */
const ClipModalMaximizedVideo = forwardRef<
  StreamVideoPlayerHandle,
  ClipModalMaximizedVideoProps
>(function ClipModalMaximizedVideo(
  { clip, swipeHandlers, overlay, onPlaybackStateChange, onViewsCountChange, onPlaybackFailed },
  ref,
) {
  const clipId = clipNumericId(clip);

  return (
    <div
      className="relative h-full w-full min-h-0 overflow-hidden bg-black"
      {...swipeHandlers}
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
        clipId={clipId}
        onViewsCountChange={onViewsCountChange}
        onPlaybackFailed={onPlaybackFailed}
        showLoadError={false}
        className="absolute inset-0 h-full w-full"
      />
      {overlay ? <div className="absolute inset-0 z-10">{overlay}</div> : null}
    </div>
  );
});

export default ClipModalMaximizedVideo;
