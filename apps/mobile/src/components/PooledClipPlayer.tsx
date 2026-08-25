import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  src: string;
  isActive: boolean;
  modalVisible: boolean;
  appActive: boolean;
};

/**
 * One hardware decoder. Neighbors stay loaded and paused so swipe-next is a play()
 * call, not a new AVPlayer. Background: pause only — do not release the instance.
 */
export function PooledClipPlayer({ src, isActive, modalVisible, appActive }: Props) {
  const player = useVideoPlayer(src, (instance) => {
    instance.loop = true;
    if ('staysActiveInBackground' in instance) {
      instance.staysActiveInBackground = false;
    }
  });

  useEffect(() => {
    const shouldPlay = isActive && modalVisible && appActive;
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch {
      /* player may be releasing */
    }
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
      contentFit="contain"
      nativeControls={isActive && modalVisible && appActive}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
});
