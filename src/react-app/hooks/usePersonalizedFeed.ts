import { useState, useEffect } from 'react';

interface Clip {
  id: number;
  artist_name: string;
  venue_name: string;
  location: string;
  video_url: string;
  thumbnail_url: string;
  stream_playback_url: string;
  likes_count: number;
  views_count: number;
  comments_count: number;
  created_at: string;
  user_display_name: string;
  user_avatar: string;
  artist_score?: number;
  location_score?: number;
  recency_score?: number;
}

interface PersonalizedFeedResponse {
  clips: Clip[];
  personalized: boolean;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function usePersonalizedFeed() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const fetchFeed = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/feed/personalized?page=${pageNum}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch personalized feed');
      }

      const data: PersonalizedFeedResponse = await response.json();
      
      if (pageNum === 1) {
        setClips(data.clips);
      } else {
        setClips(prev => [...prev, ...data.clips]);
      }
      
      setPersonalized(data.personalized);
      setHasMore(data.hasMore);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      console.error('Personalized feed error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(1);
  }, []);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchFeed(page + 1);
    }
  };

  const refresh = () => {
    fetchFeed(1);
  };

  return {
    clips,
    loading,
    error,
    personalized,
    hasMore,
    loadMore,
    refresh
  };
}
