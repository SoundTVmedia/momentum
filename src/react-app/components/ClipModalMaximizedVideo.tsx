import { forwardRef, type ReactNode } from 'react';
import StreamVideoPlayer, {
  type StreamVideoPlayerHandle,
  type StreamVideoPlayerPlaybackState,
} from '@/react-app/components/StreamVideoPlayer';
import { clipDisplayAspectRatio } from '@/react-app/utils/clipDisplayAspectRatio';
import type { ClipWithUser } from '@/shared/types';

type ClipModalMaximizedVideoProps = {
  clip: ClipWithUser;
  swipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  overlay?: ReactNode;
  onPlaybackStateChange?: (state: StreamVideoPlayerPlaybackState) => void;
};

/** Fills available space while preserving the clip's aspect ratio (object-contain behavior). */
const ClipModalMaximizedVideo = forwardRef<
  StreamVideoPlayerHandle,
  ClipModalMaximizedVideoProps
>(function ClipModalMaximizedVideo(
  { clip, swipeHandlers, overlay, onPlaybackStateChange },
  ref,
) {
  const ratioStr = clipDisplayAspectRatio(clip) ?? '9 / 16';
  const parts = ratioStr.split('/').map((s) => parseFloat(s.trim()));
  const rw = parts[0] || 16;
  const rh = parts[1] || 9;
  const portrait = rh > rw;

  return (
    <div
      className="relative flex h-full w-full min-h-0 items-center justify-center bg-black"
      {...swipeHandlers}
    >
      <div
        className={`relative overflow-hidden bg-black ${
          portrait ? 'h-full w-auto max-w-full' : 'h-auto w-full max-h-full'
        }`}
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
          controlsPlacement="hidden"
          onPlaybackStateChange={onPlaybackStateChange}
          className="absolute inset-0 h-full w-full"
        />
        {overlay ? <div className="absolute inset-0 z-10">{overlay}</div> : null}
      </div>
    </div>
  );
});

export default ClipModalMaximizedVideo;
