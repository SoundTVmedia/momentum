import { useCallback } from 'react';
import { useParams } from 'react-router';
import { useAutoRetryPageLoad } from '@/react-app/hooks/useAutoRetryPageLoad';
import { fetchJsonWithRetry } from '@/react-app/lib/fetch-json-with-retry';
import { MapPin, Calendar, Music, Loader2, UserPlus, UserMinus, Users } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import PastShowsSection from '@/react-app/components/PastShowsSection';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { useFollow } from '@/react-app/hooks/useFollow';
import type { ClipWithUser } from '@/shared/types';
import { HOME_FEED_SECTION_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { venueUpcomingCarouselProps } from '@/react-app/lib/venue-upcoming-events';
import { apiVenuePath } from '@/shared/app-paths';

interface Venue {
  id: number;
  name: string;
  location: string | null;
  address: string | null;
  image_url: string | null;
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

interface UpcomingEvent {
  id: number;
  artist_id: number;
  venue_id: number;
  date: string;
  city: string | null;
  country: string | null;
  ticket_url: string | null;
  artist_name: string | null;
  artist_image: string | null;
  created_at: string;
  updated_at: string;
}

interface VenueData {
  venue: Venue;
  clips: ClipWithUser[];
  upcomingEvents: UpcomingEvent[];
  upcomingJamBaseEvents?: Record<string, unknown>[] | null;
  jambase_attribution?: boolean;
}

export default function VenuePage() {
  const { venueName } = useParams<{ venueName: string }>();
  const {
    toggleFollowVenue,
    isFollowingVenue,
    isVenueFollowLoading,
    hydrated: followHydrated,
  } = useFollow();
  
  const loadVenuePage = useCallback(
    async (signal: AbortSignal): Promise<VenueData> => {
      if (!venueName) throw new Error('Missing venue');
      return fetchJsonWithRetry<VenueData>(
        apiVenuePath(venueName),
        { signal },
        {
          isValid: (payload) =>
            Boolean(
              payload?.venue &&
                typeof payload.venue === 'object' &&
                typeof (payload.venue as Venue).name === 'string' &&
                (payload.venue as Venue).name.trim().length > 0,
            ),
        },
      );
    },
    [venueName],
  );

  const { data, loading, slowLoad } = useAutoRetryPageLoad({
    enabled: Boolean(venueName),
    load: loadVenuePage,
    validate: (payload) => Boolean(payload.venue?.name?.trim()),
  });

  if (loading || !data?.venue) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
          {slowLoad ? (
            <p className="mt-4 text-sm text-gray-400">Still loading this venue…</p>
          ) : null}
        </div>
      </div>
    );
  }

  const { venue, clips, upcomingEvents } = data;
  const venueCapacity =
    venue.capacity != null && Number.isFinite(Number(venue.capacity))
      ? Number(venue.capacity)
      : null;

  return (
    <div className="min-h-screen text-white">
      <Header />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-momentum-ember/25 to-black border-b border-momentum-ember/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Venue Image */}
            <div className="relative">
              <img
                src={venue.image_url || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&h=300&fit=crop'}
                alt={venue.name}
                className="w-48 h-48 rounded-xl object-cover border-4 border-momentum-flare/40 shadow-xl shadow-momentum-ember/25"
              />
            </div>

            {/* Venue Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <MapPin className="w-8 h-8 text-momentum-flare" />
                <h1 className="text-5xl font-bold text-white">{venue.name}</h1>
              </div>

              {venue.location && (
                <div className="flex items-center space-x-2 mb-4">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <p className="text-gray-300 text-lg">{venue.location}</p>
                </div>
              )}

              {venue.address && (
                <p className="text-gray-400 mb-4">{venue.address}</p>
              )}

              {venueCapacity != null && (
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <p className="text-gray-400">
                    Capacity:{' '}
                    <span className="text-white font-medium">{venueCapacity.toLocaleString()}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Live Clips/Moments Section */}
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <Music className="w-6 h-6 text-momentum-flare" />
                <h2 className="text-3xl font-bold text-white">Live Moments</h2>
                <span className="px-3 py-1 bg-momentum-flare/20 text-momentum-flare text-sm rounded-full font-medium">
                  {clips.length} clips
                </span>
              </div>
              
              {clips.length > 0 ? (
                <ConcertFeed
                  venueName={venue.name}
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                />
              ) : (
                <div className="text-center py-12 glass-panel border border-momentum-flare/20 rounded-xl">
                  <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Nothing here yet</p>
                  <p className="text-gray-500 mt-2">Drop the first clip from {venue.name}!</p>
                </div>
              )}
            </div>

            <PastShowsSection
              fetchUrl={`${apiVenuePath(venue.name)}/archive`}
              variant="venue"
              showSort
            />

            <section className={HOME_FEED_SECTION_CLASS}>
              <SectionHeading
                title="Upcoming shows"
                subtitle={
                  data.jambase_attribution
                    ? 'Live dates at this venue from JamBase'
                    : 'Upcoming dates at this venue'
                }
                icon={Calendar}
                iconClassName="text-momentum-flare"
                size="page"
              />
              <JamBaseEventGrid
                {...venueUpcomingCarouselProps(
                  venue,
                  upcomingEvents,
                  data.upcomingJamBaseEvents,
                  24,
                )}
                layout="carousel"
                carouselAriaLabel={`Upcoming shows at ${venue.name}`}
                carouselClassName={PAGE_CAROUSEL_BLEED}
              />
              {data.jambase_attribution ? (
                <p className="mt-4 text-center text-xs text-gray-500">
                  <a
                    href="https://www.jambase.com"
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="text-gray-400 hover:text-momentum-flare/90 underline"
                  >
                    Show listings powered by JamBase
                  </a>
                </p>
              ) : null}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <button 
              onClick={() => venue && void toggleFollowVenue(venue.id)}
              disabled={!followHydrated || !venue || isVenueFollowLoading(venue.id)}
              className={`w-full px-6 py-4 rounded-xl font-semibold hover:scale-105 transition-transform flex items-center justify-center space-x-2 disabled:opacity-60 disabled:hover:scale-100 ${
                venue && isFollowingVenue(venue.id)
                  ? 'bg-white/10 border border-momentum-flare/50 text-white'
                  : 'bg-gradient-to-r from-momentum-ember to-momentum-flare text-white'
              }`}
            >
              {venue && isFollowingVenue(venue.id) ? (
                <>
                  <UserMinus className="w-5 h-5" />
                  <span>Unfollow Venue</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Follow Venue</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
