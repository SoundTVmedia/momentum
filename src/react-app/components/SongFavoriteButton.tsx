import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';

type SongFavoriteButtonProps = {
  slug: string;
  title: string;
  className?: string;
};

export default function SongFavoriteButton({ slug, title, className = '' }: SongFavoriteButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !slug) return;
    const res = await apiFetch('/api/users/me/favorites?type=song', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { favorites?: { entity_key?: string }[] };
    setSaved((data.favorites ?? []).some((row) => (row.entity_key ?? '').toLowerCase() === slug.toLowerCase()));
  }, [slug, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!user) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      if (saved) {
        await apiFetch(`/api/users/me/favorites/song/${encodeURIComponent(slug)}`, { method: 'DELETE' });
        setSaved(false);
      } else {
        const res = await apiFetch('/api/users/me/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'song', name: title || slug }),
        });
        if (res.ok) setSaved(true);
      }
      window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 ${className}`}
      aria-pressed={saved}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${saved ? 'fill-momentum-flare text-momentum-flare' : ''}`} />}
      {saved ? 'Saved song' : 'Save song'}
    </button>
  );
}
