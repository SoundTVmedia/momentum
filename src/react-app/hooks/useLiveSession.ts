import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';

interface LiveSession {
  id: number;
  start_time: string;
  end_time: string;
  title: string | null;
  description: string | null;
  status: string;
  total_viewers: number;
  current_clip_id: number | null;
  created_at: string;
  updated_at: string;
}

interface LiveSessionData {
  session: LiveSession | null;
  currentClip: ClipWithUser | null;
  viewerCount: number;
}

export function useLiveSession() {
  const { user } = useAuth();
  const [data, setData] = useState<LiveSessionData>({
    session: null,
    currentClip: null,
    viewerCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveSession = useCallback(async () => {
    try {
      const response = await fetch('/api/live/current');
      
      if (!response.ok) {
        throw new Error('Failed to fetch live session');
      }

      const sessionData = await response.json();
      setData(sessionData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch live session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!data.session) return;

    try {
      const response = await fetch('/api/live/viewer-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: data.session.id,
          user_id: user?.id || null,
        }),
      });

      if (response.ok) {
        const heartbeatData = await response.json();
        setData((prev) => ({
          ...prev,
          viewerCount: heartbeatData.viewerCount,
        }));
      }
    } catch (err) {
      console.error('Failed to send heartbeat:', err);
    }
  }, [data.session, user]);

  // Initial fetch
  useEffect(() => {
    fetchLiveSession();
  }, [fetchLiveSession]);

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchLiveSession, 10000);
    return () => clearInterval(interval);
  }, [fetchLiveSession]);

  // Send heartbeat every 15 seconds if session is live
  useEffect(() => {
    if (data.session?.status === 'live') {
      sendHeartbeat();
      const interval = setInterval(sendHeartbeat, 15000);
      return () => clearInterval(interval);
    }
  }, [data.session?.status, sendHeartbeat]);

  return {
    session: data.session,
    currentClip: data.currentClip,
    viewerCount: data.viewerCount,
    loading,
    error,
    refresh: fetchLiveSession,
  };
}
