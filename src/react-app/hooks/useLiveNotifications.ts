import { useState, useCallback } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { useRealtime } from './useRealtime';

interface Notification {
  id: number;
  type: string;
  content: string;
  created_at: string;
}

export function useLiveNotifications() {
  const { user } = useAuth();
  const [liveNotifications, setLiveNotifications] = useState<Notification[]>([]);

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'notification') {
      setLiveNotifications((prev) => [message.data, ...prev]);
    }
  }, []);

  const { connected } = useRealtime({
    channels: user ? [`user:${user.id}`] : [],
    onMessage: handleMessage,
  });

  const clearNotifications = useCallback(() => {
    setLiveNotifications([]);
  }, []);

  return {
    connected,
    liveNotifications,
    clearNotifications,
  };
}
