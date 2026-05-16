import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, Save, Star } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import FavoriteArtistsJamBaseField from '@/react-app/components/FavoriteArtistsJamBaseField';

type Props = {
  /** Bump parent key so FavoriteArtistFeedPanel refetches after save */
  onSaved: () => void;
};

export default function DiscoverFavoriteArtistsPrompt({ onSaved }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshVisibility = useCallback(async () => {
    if (!user) {
      setChecking(false);
      setShowPrompt(false);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch('/api/users/me/favorite-artists', { credentials: 'include' });
      if (!res.ok) {
        setShowPrompt(false);
        return;
      }
      const data = (await res.json()) as { artists?: unknown[] };
      const count = Array.isArray(data.artists) ? data.artists.length : 0;
      setShowPrompt(count === 0);
    } catch {
      setShowPrompt(false);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshVisibility();
  }, [refreshVisibility]);

  const handleSave = async () => {
    if (favoriteArtists.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/users/favorite-artists/sync-by-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ names: favoriteArtists }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(err.detail || err.error || 'Could not save artists');
      }
      setFavoriteArtists([]);
      onSaved();
      await refreshVisibility();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!user || checking || !showPrompt) {
    return null;
  }

  return (
    <section className="mb-10 rounded-2xl border border-purple-500/35 bg-gradient-to-br from-purple-950/40 to-black/50 p-5 sm:p-6 backdrop-blur-lg">
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <Star className="w-7 h-7 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Follow artists on Discover</h2>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Search JamBase or type a name, add a few favorites, then save. We&apos;ll surface clips and tour
            picks from those artists here.
          </p>
        </div>
      </div>

      <FavoriteArtistsJamBaseField
        favoriteArtists={favoriteArtists}
        setFavoriteArtists={setFavoriteArtists}
        labelExtra={
          <span className="text-gray-400 text-sm ml-2 font-normal">(saved to your Discover feed)</span>
        }
      />

      {saveError ? <p className="text-red-400 text-sm mt-3">{saveError}</p> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || favoriteArtists.length === 0}
          onClick={() => void handleSave()}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-[1.02] transition-transform disabled:opacity-45 disabled:hover:scale-100"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save to your feed
            </>
          )}
        </button>
        <span className="text-gray-500 text-xs flex flex-wrap items-center gap-x-1 gap-y-1">
          <Heart className="w-3.5 h-3.5 text-pink-400/90 shrink-0" />
          <span>More options in</span>
          <button
            type="button"
            onClick={() => navigate(user ? `/users/${user.id}` : '/')}
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            profile settings
          </button>
          .
        </span>
      </div>
    </section>
  );
}
