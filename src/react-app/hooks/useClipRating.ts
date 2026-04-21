import { useState, useEffect } from 'react';

export function useClipRating(clipId: number | string) {
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRating();
  }, [clipId]);

  const fetchRating = async () => {
    try {
      const response = await fetch(`/api/clips/${clipId}/rating`);
      if (response.ok) {
        const data = await response.json();
        setRating(data.rating);
      }
    } catch (error) {
      console.error('Failed to fetch rating:', error);
    }
  };

  const rateClip = async (newRating: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating }),
      });

      if (response.ok) {
        const data = await response.json();
        setRating(newRating);
        return data;
      }
    } catch (error) {
      console.error('Failed to rate clip:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    rating,
    rateClip,
    loading,
  };
}
