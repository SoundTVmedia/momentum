import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import {
  addFavoriteArtistName,
  favoriteArtistsErrorMessage,
  loadFavoriteArtistNames,
  removeFavoriteArtistName,
} from '@/react-app/lib/favorite-artists-api';

function normalizeArtistName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Favorite-artist toggle for artist pages — uses `/api/personalization/update` (home feed + profile editor).
 */
export function useArtistFavorite(_artistId: number, artistName: string) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const syncFromServer = useCallback(async () => {
    const name = artistName.trim();
    if (!user || !name) {
      setFavorited(false);
      return;
    }

    try {
      const names = await loadFavoriteArtistNames();
      const nameKey = normalizeArtistName(name);
      setFavorited(names.some((n) => normalizeArtistName(n) === nameKey));
    } catch {
      setFavorited(false);
    }
  }, [user, artistName]);

  useEffect(() => {
    setFavorited(null);
    void syncFromServer();
  }, [syncFromServer]);

  useEffect(() => {
    const onChange = () => void syncFromServer();
    window.addEventListener('favorite-artists-changed', onChange);
    return () => window.removeEventListener('favorite-artists-changed', onChange);
  }, [syncFromServer]);

  const toggleFavorite = useCallback(async () => {
    const name = artistName.trim();
    if (!user) {
      alert('Please sign in to save favorite artists');
      return;
    }
    if (!name) return;

    setLoading(true);
    const wasFavorited = favorited === true;
    try {
      if (wasFavorited) {
        await removeFavoriteArtistName(name);
        setFavorited(false);
      } else {
        await addFavoriteArtistName(name);
        setFavorited(true);
      }
      window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    } catch (err) {
      console.error('toggle artist favorite:', err);
      alert(favoriteArtistsErrorMessage(err));
      await syncFromServer();
    } finally {
      setLoading(false);
    }
  }, [user, artistName, favorited, syncFromServer]);

  return {
    favorited: favorited === true,
    favoritedKnown: favorited !== null,
    loading,
    toggleFavorite,
    refresh: syncFromServer,
  };
}
