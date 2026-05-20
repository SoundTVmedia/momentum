import { useEffect, useState } from 'react';
import { Calendar, MapPin, ExternalLink, Loader2, Heart } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { artistPath } from '@/shared/app-paths';
import SectionHeading from '@/react-app/components/SectionHeading';
import {
  EVENT_CAROUSEL_CARD_CLASS,
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

export type ShowsSectionMode = 'favorite-artists' | 'nearby' | 'auto';

export type PersonalizedConcertsProps = {
  /** Match Discover / home feed carousels (`page`) vs nested profile shell (`home`). */
  carouselBleedScope?: 'home' | 'page';
  /** Large centered headings (logged-out homepage); default is compact feed style. */
  headingVariant?: 'compact' | 'page';
  /** `auto`: favorites when logged in, nearby when logged out. */
  mode?: ShowsSectionMode;
};

interface D1Concert {
  id: number;
  artist_name: string;
  artist_image: string;
  venue_name: string;
  venue_location: string;
  date: string;
  city: string;
  country: string;
  ticket_url: string;
}

type ConcertsApi = {
  concerts?: D1Concert[];
  events?: Record<string, unknown>[];
  personalized?: boolean;
  source?: 'jambase' | 'd1';
  message?: string;
  location?: { label?: string; source?: string };
};

function D1ConcertCard({ concert }: { concert: D1Concert }) {
  const navigate = useNavigate();

  return (
    <div
      className={`group glass-panel rounded-xl overflow-hidden hover:border-momentum-mint/50 transition-colors ${EVENT_CAROUSEL_CARD_CLASS}`}
    >
      <button
        type="button"
        onClick={() => navigate(artistPath(concert.artist_name))}
        className="relative block w-full h-48 overflow-hidden shrink-0 text-left"
        aria-label={`View ${concert.artist_name}`}
      >
        {concert.artist_image ? (
          <img
            src={concert.artist_image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-white/5" aria-hidden />
        )}
      </button>

      <div className="p-5 flex flex-col flex-1 min-h-0">
        <button
          type="button"
          onClick={() => navigate(artistPath(concert.artist_name))}
          className="text-lg font-bold text-white truncate text-left hover:text-cyan-300 transition-colors"
        >
          {concert.artist_name}
        </button>

        <div className="space-y-2 text-sm flex-1 mt-3">
          <div className="flex items-start space-x-2 text-gray-300">
            <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{concert.venue_name}</div>
              <div className="text-xs text-gray-400 truncate">{concert.venue_location}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-gray-300">
            <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>
              {new Date(concert.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-2 min-h-[44px] flex items-end">
          {concert.ticket_url ? (
            <a
              href={concert.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 px-4 py-2.5 momentum-ticket-btn rounded-lg font-semibold hover:scale-[1.02] transition-transform"
            >
              <span>Get Tickets</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function resolveMode(mode: ShowsSectionMode, isLoggedIn: boolean): 'favorite-artists' | 'nearby' {
  if (mode === 'auto') {
    return isLoggedIn ? 'favorite-artists' : 'nearby';
  }
  return mode;
}

export default function PersonalizedConcerts({
  carouselBleedScope = 'home',
  headingVariant = 'compact',
  mode = 'auto',
}: PersonalizedConcertsProps) {
  const { user, isPending: authPending } = useAuth();
  const carouselBleed =
    carouselBleedScope === 'page' ? PAGE_CAROUSEL_BLEED : HOME_FEED_CAROUSEL_BLEED;
  const [payload, setPayload] = useState<ConcertsApi | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = Boolean(user);
  const resolvedMode = resolveMode(mode, isLoggedIn);

  useEffect(() => {
    if (authPending) return;

    if (resolvedMode === 'favorite-artists' && !isLoggedIn) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const fetchConcerts = async () => {
      setLoading(true);
      try {
        if (resolvedMode === 'favorite-artists') {
          const response = await fetch('/api/personalization/concerts?limit=12', {
            credentials: 'include',
          });
          const data = (await response.json()) as ConcertsApi;
          setPayload({
            personalized: Boolean(data.personalized),
            concerts: Array.isArray(data.concerts) ? data.concerts : [],
            events: Array.isArray(data.events) ? data.events : [],
            source: data.source,
            message: typeof data.message === 'string' ? data.message : undefined,
          });
        } else {
          const response = await fetch('/api/shows/nearby?limit=12', {
            credentials: 'include',
          });
          const data = (await response.json()) as ConcertsApi & {
            jambaseNotice?: string | null;
          };
          const notice =
            typeof data.jambaseNotice === 'string' && data.jambaseNotice.trim()
              ? data.jambaseNotice.trim()
              : null;
          setPayload({
            personalized: true,
            concerts: [],
            events: Array.isArray(data.events) ? data.events : [],
            source: 'jambase',
            location: data.location,
            message:
              notice ??
              ((data.events?.length ?? 0) === 0
                ? 'No upcoming shows found near your area.'
                : undefined),
          });
        }
      } catch (error) {
        console.error('Failed to fetch concerts:', error);
        setPayload({ personalized: false, concerts: [], events: [] });
      } finally {
        setLoading(false);
      }
    };

    void fetchConcerts();
  }, [authPending, isLoggedIn, resolvedMode]);

  const locationLabel =
    typeof payload?.location?.label === 'string' && payload.location.label.trim()
      ? payload.location.label.trim()
      : null;

  const sectionTitle =
    resolvedMode === 'favorite-artists'
      ? 'Shows from Your Favorite Artists'
      : headingVariant === 'page'
        ? 'Shows Near You'
        : 'Shows at Venues Near You';

  const sectionSubtitle =
    resolvedMode === 'favorite-artists'
      ? payload?.source === 'jambase'
        ? 'Upcoming shows from JamBase for your favorite artists'
        : 'Upcoming concerts from artists you love'
      : locationLabel
        ? `Upcoming shows at venues near ${locationLabel}`
        : 'Upcoming shows at venues near you from JamBase';

  const sectionHeader = (
    <SectionHeading title={sectionTitle} subtitle={sectionSubtitle} size="section" />
  );

  if (resolvedMode === 'favorite-artists' && !isLoggedIn) {
    return null;
  }

  if (loading) {
    return (
      <div className="glass-panel rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading shows…</span>
        </div>
      </div>
    );
  }

  const jbEvents = payload?.events ?? [];
  const d1Concerts = payload?.concerts ?? [];
  const hasShows = jbEvents.length > 0 || d1Concerts.length > 0;

  if (!payload?.personalized || !hasShows) {
    if (resolvedMode === 'nearby') {
      return null;
    }
    return (
      <div className="glass-highlight rounded-xl p-8">
        <div className="text-center">
          <Heart className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            No Upcoming Concerts from Your Favorites
          </h3>
          <p className="text-gray-300 mb-4">
            {payload?.message === 'No favorite artists set'
              ? 'Add favorite artists in your profile to see JamBase tour dates here.'
              : typeof payload?.message === 'string' && payload.message.length > 0
                ? payload.message
                : "We'll show upcoming JamBase dates for artists you follow — or add favorites on your profile."}
          </p>
        </div>
      </div>
    );
  }

  const carouselAriaLabel =
    resolvedMode === 'favorite-artists'
      ? 'Upcoming shows from your favorite artists'
      : 'Upcoming shows near you';

  return (
    <div className={headingVariant === 'page' ? '' : HOME_FEED_SECTION_CLASS}>
      {sectionHeader}

      {jbEvents.length > 0 ? (
        <JamBaseEventGrid
          preloadedEvents={jbEvents}
          maxEvents={12}
          layout="carousel"
          carouselAriaLabel={carouselAriaLabel}
          carouselClassName={carouselBleed}
        />
      ) : (
        <HorizontalClipCarousel
          stretchItems
          ariaLabel="Upcoming concerts from your favorite artists"
          className={carouselBleed}
        >
          {d1Concerts.map((concert) => (
            <HorizontalClipCarouselItem key={concert.id} className="md:w-80 lg:w-96">
              <D1ConcertCard concert={concert} />
            </HorizontalClipCarouselItem>
          ))}
        </HorizontalClipCarousel>
      )}
    </div>
  );
}
