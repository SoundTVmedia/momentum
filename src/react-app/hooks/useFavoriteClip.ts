import { useState, useEffect } from 'react';

export function useFavoriteClip(clipId: number | string) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkFavorited();
  }, [clipId]);

  const checkFavorited = async () => {
    try {
      const response = await fetch(`/api/clips/${clipId}/favorited`);
      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.favorited);
      }
    } catch (error) {
      console.error('Failed to check favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clips/${clipId}/favorite`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.favorited);
        return data.favorited;
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    isFavorited,
    toggleFavorite,
    loading,
  };
}
