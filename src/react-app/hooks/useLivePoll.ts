import { useState, useEffect, useCallback } from 'react';

interface PollOption {
  option_index: number;
  votes: number;
  percentage: number;
}

interface Poll {
  id: number;
  question: string;
  options: string[];
  is_active: boolean;
  results?: {
    total_votes: number;
    results: PollOption[];
  };
}

export function useLivePoll(sessionId: number | null) {
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchActivePoll = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/live/${sessionId}/polls/active`);
      if (response.ok) {
        const data = await response.json();
        setActivePoll(data.poll || null);
      }
    } catch (err) {
      console.error('Failed to fetch active poll:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchActivePoll();
      
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchActivePoll, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionId, fetchActivePoll]);

  return {
    activePoll,
    loading,
    refreshPoll: fetchActivePoll,
  };
}
