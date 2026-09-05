import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Link } from 'react-router';
import { Loader2, Music, Save } from 'lucide-react';
import ArtistImageCard from '@/react-app/components/ArtistImageCard';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import FavoriteArtistsJamBaseField from '@/react-app/components/FavoriteArtistsJamBaseField';
import Header from '@/react-app/components/Header';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { artistPath } from '@/shared/app-paths';

type FavoriteArtist = {
  artist_id?: number;
  name: string;
  image_url?: string | null;
};

export default function ArtistHubPage() {
  const { user, isPending } = useAuth();
  const [artists, setArtists] = useState<FavoriteArtist[]>([]);
  const [favoriteNames, setFavoriteNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadArtists = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch('/api/users/me/favorite-artists', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load favorite artists');
      const data = (await response.json()) as { artists?: FavoriteArtist[] };
      const next = (data.artists ?? []).filter((artist) => artist.name?.trim());
      setArtists(next);
      setFavoriteNames(next.map((artist) => artist.name));
      setSelectedName((current) =>
        current && next.some((artist) => artist.name === current) ? current : next[0]?.name ?? '',
      );
      setError(null);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not load favorite artists'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isPending) void loadArtists();
  }, [isPending, loadArtists]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => void loadArtists();
    window.addEventListener('favorite-artists-changed', refresh);
    window.addEventListener('following-changed', refresh);
    return () => {
      window.removeEventListener('favorite-artists-changed', refresh);
      window.removeEventListener('following-changed', refresh);
    };
  }, [user, loadArtists]);

  const saveFavorites = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch('/api/personalization/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite_artists: favoriteNames,
          personalization_enabled: true,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(body.detail || body.error || 'Could not save favorite artists');
      }
      window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
      window.dispatchEvent(new CustomEvent('following-changed'));
      await loadArtists();
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not save favorite artists'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeading
          title="Artist Hub"
          subtitle="Your saved favorite artists — clips and upcoming shows in one place."
          icon={Music}
          size="page"
        />

        {isPending || loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-momentum-flare" />
          </div>
        ) : !user ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <p className="text-gray-300">Sign in to build your Artist Hub.</p>
            <Link
              to="/auth"
              className="mt-5 inline-block rounded-xl momentum-grad-interactive px-6 py-3 font-semibold"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <section className="glass-panel mb-10 rounded-2xl border border-white/10 p-5 sm:p-6">
              <FavoriteArtistsJamBaseField
                favoriteArtists={favoriteNames}
                setFavoriteArtists={setFavoriteNames}
                labelExtra={
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    Favorites from the homepage appear here. Add or remove, then save.
                  </span>
                }
              />
              {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
              <button
                type="button"
                onClick={() => void saveFavorites()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl momentum-grad-interactive px-5 py-2.5 font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save favorites
              </button>
            </section>

            {artists.length > 0 ? (
              <>
                <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {artists.map((artist) => (
                    <ArtistImageCard
                      key={`${artist.artist_id ?? 0}-${artist.name}`}
                      name={artist.name}
                      imageUrl={artist.image_url}
                      selected={selectedName === artist.name}
                      onClick={() => setSelectedName(artist.name)}
                    />
                  ))}
                </div>

                {selectedName ? (
                  <section className="space-y-12">
                    <div className="flex items-center justify-between gap-4">
                      <SectionHeading
                        title={selectedName}
                        subtitle={`Clips and tour dates for ${selectedName}`}
                        size="section"
                      />
                      <Link
                        to={artistPath(selectedName)}
                        className="shrink-0 text-sm text-momentum-flare hover:text-white"
                      >
                        Artist page
                      </Link>
                    </div>

                    <div>
                      <SectionHeading
                        title="Latest clips"
                        subtitle={`Fan-captured moments featuring ${selectedName}`}
                        size="section"
                      />
                      <ConcertFeed artistName={selectedName} hideSectionHeader />
                    </div>

                    <div>
                      <SectionHeading
                        title="Upcoming shows"
                        subtitle={`Tour dates for ${selectedName}`}
                        size="section"
                      />
                      <JamBaseEventGrid
                        artistName={selectedName}
                        maxEvents={24}
                        layout="carousel"
                        carouselAriaLabel={`Upcoming shows for ${selectedName}`}
                        carouselClassName={PAGE_CAROUSEL_BLEED}
                      />
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="glass-highlight rounded-2xl p-8 text-center text-gray-300">
                Follow artists from the homepage or add one above to start your hub.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
