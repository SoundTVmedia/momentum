import { useState, useEffect } from 'react';

interface FavoriteArtist {
  id: number;
  artist_id: number;
  name: string;
  image_url: string | null;
  bio: string | null;
}

export function useFavoriteArtists() {
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavoriteArtists();
  }, []);

  const fetchFavoriteArtists = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/me/favorite-artists');
      if (response.ok) {
        const data = await response.json();
        setFavoriteArtists(data.artists || []);
      }
    } catch (error) {
      console.error('Failed to fetch favorite artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavoriteArtist = async (artistId: number) => {
    try {
      const response = await fetch('/api/users/favorite-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_id: artistId }),
      });

      if (response.ok) {
        await fetchFavoriteArtists();
      }
    } catch (error) {
      console.error('Failed to toggle favorite artist:', error);
    }
  };

  return {
    favoriteArtists,
    loading,
    toggleFavoriteArtist,
    refresh: fetchFavoriteArtists,
  };
}
