import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { artistFollowApiTarget } from '@/react-app/lib/artist-follow-key';

function normalizeArtistName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Favorite-artist toggle for artist pages — backed by `user_favorite_artists`, not social `follows`.
 */
export function useArtistFavorite(artistId: number, artistName: string) {
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
      const [favRes, meRes] = await Promise.all([
        apiFetch('/api/users/me/favorite-artists', { cache: 'no-store' }),
        apiFetch('/api/users/me', { cache: 'no-store' }),
      ]);

      const names = new Set<string>();
      if (favRes.ok) {
        const data = (await favRes.json()) as {
          artists?: { artist_id?: unknown; name?: unknown }[];
        };
        const rows = Array.isArray(data.artists) ? data.artists : [];
        const nameKey = normalizeArtistName(name);
        const match = rows.some((row) => {
          const rowId =
            typeof row.artist_id === 'number' ? row.artist_id : Number(row.artist_id);
          if (artistId > 0 && Number.isFinite(rowId) && rowId === artistId) return true;
          const rowName = typeof row.name === 'string' ? row.name.trim() : '';
          if (rowName.length > 0) names.add(normalizeArtistName(rowName));
          return rowName.length > 0 && normalizeArtistName(rowName) === nameKey;
        });
        if (match) {
          setFavorited(true);
          return;
        }
      }

      if (meRes.ok) {
        const me = (await meRes.json()) as {
          profile?: { favorite_artists?: string | null } | null;
        } | null;
        const json = me?.profile?.favorite_artists;
        if (json) {
          try {
            const parsed = JSON.parse(json) as unknown;
            if (Array.isArray(parsed)) {
              for (const x of parsed) {
                const n = typeof x === 'string' ? x.trim() : String(x ?? '').trim();
                if (n) names.add(normalizeArtistName(n));
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      const nameKey = normalizeArtistName(name);
      setFavorited(names.has(nameKey));
    } catch {
      setFavorited(false);
    }
  }, [user, artistId, artistName]);

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
      alert('Please sign in to follow artists');
      return;
    }
    if (!name) return;

    setLoading(true);
    try {
      const target = artistFollowApiTarget(artistId);
      const res = await apiFetch(`/api/users/${encodeURIComponent(target)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: name }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to update favorite artist');
      }

      const data = (await res.json()) as { following?: boolean };
      setFavorited(!!data.following);
      window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    } catch (err) {
      console.error('toggle artist favorite:', err);
      alert(err instanceof Error ? err.message : 'Could not update favorite artist');
      await syncFromServer();
    } finally {
      setLoading(false);
    }
  }, [user, artistId, artistName, syncFromServer]);

  return {
    favorited: favorited === true,
    favoritedKnown: favorited !== null,
    loading,
    toggleFavorite,
    refresh: syncFromServer,
  };
}
