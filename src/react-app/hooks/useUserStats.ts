import { useState, useEffect } from 'react';

interface UserStats {
  totalClipsPosted: number;
  totalViewsOnClips: number;
  userAverageClipRating: number;
}

export function useUserStats(userId: string) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [userId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    refresh: fetchStats,
  };
}
