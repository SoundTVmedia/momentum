import { useState, useEffect, useCallback } from 'react';

interface ScheduleItem {
  id: number;
  live_session_id: number;
  clip_id: number;
  order_index: number;
  scheduled_start_time: string | null;
  duration: number | null;
  played_at: string | null;
  artist_name: string | null;
  venue_name: string | null;
  thumbnail_url: string | null;
  content_description: string | null;
  user_display_name: string | null;
}

export function useLiveSchedule(sessionId: number | null) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/live/schedule?session_id=${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch schedule');
      }

      const data = await response.json();
      setSchedule(data.schedule || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchSchedule();
      
      // Poll for schedule updates every 30 seconds
      const interval = setInterval(fetchSchedule, 30000);
      return () => clearInterval(interval);
    }
  }, [sessionId, fetchSchedule]);

  return {
    schedule,
    loading,
    error,
    refresh: fetchSchedule,
  };
}
