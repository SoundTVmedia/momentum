import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  src: string;
  isActive: boolean;
  modalVisible: boolean;
  appActive: boolean;
  /** Fast/5G: ask AVPlayer to hold the whole ≤60s clip. */
  prefetchFull?: boolean;
};

const HEAD_BUFFER_SECONDS = 8;
const FULL_BUFFER_SECONDS = 60;

function applyBufferOptions(
  instance: { bufferOptions: { preferredForwardBufferDuration?: number; waitsToMinimizeStalling?: boolean } },
  full: boolean,
): void {
  instance.bufferOptions = {
    preferredForwardBufferDuration: full ? FULL_BUFFER_SECONDS : HEAD_BUFFER_SECONDS,
    waitsToMinimizeStalling: true,
  };
}

/**
 * One hardware decoder. Neighbors stay loaded and paused so swipe-next is a play()
 * call, not a new AVPlayer. Background: pause only — do not release the instance.
 */
export function PooledClipPlayer({
  src,
  isActive,
  modalVisible,
  appActive,
  prefetchFull = false,
}: Props) {
  const player = useVideoPlayer(src, (instance) => {
    instance.loop = true;
    instance.muted = true;
    applyBufferOptions(instance, prefetchFull);
    if ('staysActiveInBackground' in instance) {
      instance.staysActiveInBackground = false;
    }
  });

  useEffect(() => {
    applyBufferOptions(player, prefetchFull);
  }, [player, prefetchFull]);

  useEffect(() => {
    const inForeground = modalVisible && appActive;
    const shouldPlay = isActive && inForeground;
    let kickTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      player.muted = !shouldPlay;
      if (shouldPlay) {
        player.play();
      } else if (inForeground) {
        // iOS / ExoPlayer ignore preload until playback starts (muted is enough).
        player.play();
        kickTimer = setTimeout(() => {
          try {
            player.pause();
          } catch {
            /* ignore */
          }
        }, 280);
      } else {
        player.muted = true;
        player.pause();
      }
    } catch {
      /* player may be releasing */
    }
    return () => {
      if (kickTimer) clearTimeout(kickTimer);
    };
  }, [appActive, isActive, modalVisible, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [player]);

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="cover"
      nativeControls={isActive && modalVisible && appActive}
    />
  );
}

/**
 * Extra decoder with no view — warms the clip after next (index+2) on fast networks
 * without expanding the on-screen player radius.
 */
export function OffscreenClipPrefetch({ src, full }: { src: string; full: boolean }) {
  const player = useVideoPlayer(src, (instance) => {
    instance.loop = false;
    instance.muted = true;
    applyBufferOptions(instance, full);
    if ('staysActiveInBackground' in instance) {
      instance.staysActiveInBackground = false;
    }
  });

  useEffect(() => {
    applyBufferOptions(player, full);
    let kickTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      player.muted = true;
      player.play();
      kickTimer = setTimeout(() => {
        try {
          player.pause();
        } catch {
          /* ignore */
        }
      }, full ? 600 : 280);
    } catch {
      /* ignore */
    }
    return () => {
      if (kickTimer) clearTimeout(kickTimer);
    };
  }, [full, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [player]);

  return null;
}

const styles = StyleSheet.create({
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
});
