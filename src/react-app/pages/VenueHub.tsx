import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Link } from 'react-router';
import { Loader2, MapPin, UserMinus } from 'lucide-react';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import Header from '@/react-app/components/Header';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { FOLLOWING_CHANGED_EVENT, useFollow } from '@/react-app/hooks/useFollow';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { venueUpcomingCarouselProps, type VenueUpcomingRow } from '@/react-app/lib/venue-upcoming-events';
import { apiVenuePath, venuePath } from '@/shared/app-paths';

type FollowedVenue = {
  venue_id: number;
  name: string;
  location: string | null;
  image_url: string | null;
};

type VenueDetails = {
  venue: FollowedVenue & {
    id: number;
    address?: string | null;
    capacity?: number | null;
  };
  upcomingEvents: VenueUpcomingRow[];
  upcomingJamBaseEvents?: Record<string, unknown>[] | null;
};

export default function VenueHubPage() {
  const { user, isPending } = useAuth();
  const { toggleFollowVenue, isVenueFollowLoading } = useFollow();
  const [venues, setVenues] = useState<FollowedVenue[]>([]);
  const [selected, setSelected] = useState<FollowedVenue | null>(null);
  const [details, setDetails] = useState<VenueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVenues = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch('/api/users/me/following/list', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load followed venues');
      const data = (await response.json()) as { venues?: FollowedVenue[] };
      const next = data.venues ?? [];
      setVenues(next);
      setSelected((current) =>
        current && next.some((venue) => venue.venue_id === current.venue_id)
          ? current
          : next[0] ?? null,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load followed venues');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isPending) void loadVenues();
  }, [isPending, loadVenues]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => void loadVenues();
    window.addEventListener(FOLLOWING_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FOLLOWING_CHANGED_EVENT, refresh);
  }, [user, loadVenues]);

  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    void apiFetch(apiVenuePath(selected.name), { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load venue details');
        const data = (await response.json()) as VenueDetails;
        if (!cancelled) setDetails(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load venue');
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const unfollowSelected = async () => {
    if (!selected) return;
    const result = await toggleFollowVenue(selected.venue_id, selected.name);
    if (result.success && !result.following) await loadVenues();
  };

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            title="Venue Hub"
            subtitle="Shows and clips from the venues you follow."
            icon={MapPin}
            size="page"
          />
          <Link
            to="/discover"
            className="rounded-xl momentum-grad-interactive px-5 py-2.5 text-sm font-semibold"
          >
            Find venues
          </Link>
        </div>

        {isPending || loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-momentum-flare" />
          </div>
        ) : !user ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <p className="text-gray-300">Sign in to build your Venue Hub.</p>
            <Link
              to="/auth"
              className="mt-5 inline-block rounded-xl momentum-grad-interactive px-6 py-3 font-semibold"
            >
              Sign in
            </Link>
          </div>
        ) : venues.length === 0 ? (
          <div className="glass-highlight rounded-2xl p-8 text-center">
            <p className="text-gray-300">You are not following any venues yet.</p>
            <Link to="/discover" className="mt-4 inline-block text-momentum-flare hover:text-white">
              Discover venues and shows
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <button
                  key={venue.venue_id}
                  type="button"
                  onClick={() => setSelected(venue)}
                  className={`glass-panel flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                    selected?.venue_id === venue.venue_id
                      ? 'border-momentum-flare/70 bg-momentum-flare/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
                    {venue.image_url ? (
                      <img src={venue.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <MapPin className="h-5 w-5 text-momentum-flare" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{venue.name}</p>
                    {venue.location ? (
                      <p className="truncate text-sm text-gray-400">{venue.location}</p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>

            {selected ? (
              <section className="space-y-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-3xl font-bold">{selected.name}</h2>
                    <Link
                      to={venuePath(selected.name)}
                      className="mt-1 inline-block text-sm text-momentum-flare hover:text-white"
                    >
                      Open venue page
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => void unfollowSelected()}
                    disabled={isVenueFollowLoading(selected.venue_id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-60"
                  >
                    {isVenueFollowLoading(selected.venue_id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserMinus className="h-4 w-4" />
                    )}
                    Unfollow
                  </button>
                </div>

                <div>
                  <SectionHeading
                    title="Upcoming shows"
                    subtitle={`Upcoming dates at ${selected.name}`}
                    size="section"
                  />
                  {detailsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-momentum-flare" />
                    </div>
                  ) : details ? (
                    <JamBaseEventGrid
                      {...venueUpcomingCarouselProps(
                        details.venue,
                        details.upcomingEvents ?? [],
                        details.upcomingJamBaseEvents,
                        24,
                      )}
                      layout="carousel"
                      carouselAriaLabel={`Shows at ${selected.name}`}
                    />
                  ) : null}
                </div>

                <div>
                  <SectionHeading
                    title="Latest clips"
                    subtitle={`Fan-captured moments from ${selected.name}`}
                    size="section"
                  />
                  <ConcertFeed venueName={selected.name} hideSectionHeader />
                </div>
              </section>
            ) : null}
          </>
        )}

        {error ? <p className="mt-6 text-sm text-red-300">{error}</p> : null}
      </main>
    </div>
  );
}
