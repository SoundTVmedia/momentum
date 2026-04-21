import { useState, useCallback } from 'react';
import { useRealtime } from './useRealtime';

export function useLiveFeed() {
  const [newClipsAvailable, setNewClipsAvailable] = useState(false);
  const [newClipIds, setNewClipIds] = useState<number[]>([]);

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'feed_update') {
      setNewClipIds((prev) => [...prev, message.data.clipId]);
      setNewClipsAvailable(true);
    }
  }, []);

  const { connected } = useRealtime({
    channels: ['feed'],
    onMessage: handleMessage,
  });

  const clearNewClips = useCallback(() => {
    setNewClipsAvailable(false);
    setNewClipIds([]);
  }, []);

  return {
    connected,
    newClipsAvailable,
    newClipIds,
    clearNewClips,
  };
}
