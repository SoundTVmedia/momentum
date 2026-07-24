import { useCallback, useEffect, useState } from 'react';
import { BROWSE_NEARBY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import {
  nearbyShowsApiUrl,
  readDeviceCoordsForNearbyShows,
} from '@/react-app/lib/nearby-shows-url';
import { Calendar, MapPin, Loader2, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { artistPath } from '@/shared/app-paths';
import CarouselFeedFooter from '@/react-app/components/CarouselFeedFooter';
import SectionHeading from '@/react-app/components/SectionHeading';
import EventTicketActions from '@/react-app/components/EventTicketActions';
import {
  EVENT_CAROUSEL_CARD_CLASS,
  EVENT_CAROUSEL_IMAGE_CLASS,
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';
import { displayMediaUrl } from '@/shared/media-proxy';

export type ShowsSectionMode = 'favorite-artists' | 'nearby' | 'auto';

export type PersonalizedConcertsProps = {
  /** Match Discover / home feed carousels (`page`) vs nested profile shell (`home`). */
  carouselBleedScope?: 'home' | 'page';
  /** Large centered headings (logged-out homepage); default is compact feed style. */
  headingVariant?: 'compact' | 'page';
  /** `auto`: favorites when logged in, nearby when logged out. */
  mode?: ShowsSectionMode;
  /** Omit title/subtitle when a parent section already provides them (e.g. feed toggles). */
  hideHeader?: boolean;
  /** Cap carousel length before pointing users to a browse page. */
  carouselMaxEvents?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Override default section title (e.g. home feed "Upcoming Shows"). */
  sectionTitleOverride?: string;
  sectionSubtitleOverride?: string;
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
  recommendation_sources?: {
    favorite_artists?: number;
    attended_artists?: number;
  };
};

function D1ConcertCard({ concert }: { concert: D1Concert }) {
  const navigate = useNavigate();

  return (
    <div
      className={`group glass-panel rounded-xl overflow-hidden hover:border-momentum-flare/50 transition-colors ${EVENT_CAROUSEL_CARD_CLASS}`}
    >
      <button
        type="button"
        onClick={() => navigate(artistPath(concert.artist_name))}
        className={`block w-full text-left ${EVENT_CAROUSEL_IMAGE_CLASS}`}
        aria-label={`View ${concert.artist_name}`}
      >
        {concert.artist_image ? (
          <img
            src={displayMediaUrl(concert.artist_image)}
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
          className="text-lg font-bold text-white truncate text-left hover:text-momentum-flare/90 transition-colors"
        >
          {concert.artist_name}
        </button>

        <div className="space-y-1.5 text-sm flex-1 mt-2 leading-tight">
          <div className="flex items-start space-x-2 text-gray-300">
            <MapPin className="w-4 h-4 text-momentum-flare flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{concert.venue_name}</div>
              <div className="text-xs text-gray-400 truncate">{concert.venue_location}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-gray-300">
            <Calendar className="w-4 h-4 text-momentum-rose flex-shrink-0" />
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

        <div className="mt-auto pt-2 min-h-[44px] flex items-end w-full">
          {concert.ticket_url ? (
            <EventTicketActions
              ticketUrl={concert.ticket_url}
              eventTitle={concert.artist_name}
              className="w-full"
            />
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
  hideHeader = false,
  carouselMaxEvents = 12,
  viewAllHref,
  viewAllLabel = 'View all shows',
  sectionTitleOverride,
  sectionSubtitleOverride,
}: PersonalizedConcertsProps) {
  const { user, isPending: authPending } = useAuth();
  const carouselBleed =
    carouselBleedScope === 'page' ? PAGE_CAROUSEL_BLEED : HOME_FEED_CAROUSEL_BLEED;
  const [payload, setPayload] = useState<ConcertsApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearbyFetchLimit, setNearbyFetchLimit] = useState(carouselMaxEvents);

  const isLoggedIn = Boolean(user);
  const resolvedMode = resolveMode(mode, isLoggedIn);
  const resolvedViewAllHref =
    viewAllHref ?? (resolvedMode === 'nearby' ? BROWSE_NEARBY_SHOWS_PATH : undefined);

  useEffect(() => {
    if (resolvedMode === 'nearby') {
      setNearbyFetchLimit(carouselMaxEvents);
    }
  }, [resolvedMode, carouselMaxEvents]);

  useEffect(() => {
    if (authPending) return;

    if (resolvedMode === 'favorite-artists' && !isLoggedIn) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const isNearbyLoadMore = resolvedMode === 'nearby' && nearbyFetchLimit > carouselMaxEvents;

    const fetchConcerts = async () => {
      if (isNearbyLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        if (resolvedMode === 'favorite-artists') {
          const response = await fetch('/api/personalization/concerts?limit=40', {
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
          const device = await readDeviceCoordsForNearbyShows();
          const response = await fetch(
            nearbyShowsApiUrl({
              limit: nearbyFetchLimit,
              latitude: device?.latitude,
              longitude: device?.longitude,
            }),
            {
              credentials: 'include',
              signal: AbortSignal.timeout(22_000),
            },
          );
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
        if (!isNearbyLoadMore) {
          const timedOut =
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError');
          setPayload({
            personalized: true,
            concerts: [],
            events: [],
            source: 'jambase',
            message: timedOut
              ? 'Nearby shows took too long to load. Try again — if this persists, JamBase may be misconfigured on the worker.'
              : 'Could not load nearby shows. Check your connection and try again.',
          });
        }
      } finally {
        if (isNearbyLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    };

    void fetchConcerts();
  }, [authPending, isLoggedIn, resolvedMode, nearbyFetchLimit, carouselMaxEvents]);

  useEffect(() => {
    if (!isLoggedIn || resolvedMode !== 'favorite-artists') return;
    const refresh = () => {
      void (async () => {
        setLoading(true);
        try {
          const response = await fetch('/api/personalization/concerts?limit=40', {
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
        } catch (error) {
          console.error('Failed to refresh favorite-artist concerts:', error);
        } finally {
          setLoading(false);
        }
      })();
    };
    window.addEventListener('favorite-artists-changed', refresh);
    return () => {
      window.removeEventListener('favorite-artists-changed', refresh);
    };
  }, [isLoggedIn, resolvedMode]);

  const locationLabel =
    typeof payload?.location?.label === 'string' && payload.location.label.trim()
      ? payload.location.label.trim()
      : null;
  const nearbyAreaLabel =
    payload?.location?.source === 'device' ? 'your current location' : locationLabel;

  const loadMoreNearby = useCallback(() => {
    if (resolvedMode !== 'nearby' || loadingMore || loading) return;
    const count = payload?.events?.length ?? 0;
    if (count < nearbyFetchLimit || nearbyFetchLimit >= 40) return;
    setNearbyFetchLimit((prev) => Math.min(prev + 12, 40));
  }, [resolvedMode, loadingMore, loading, payload?.events?.length, nearbyFetchLimit]);

  const sectionTitle =
    sectionTitleOverride ??
    (resolvedMode === 'favorite-artists'
      ? 'Shows from Your Favorite Artists'
      : headingVariant === 'page'
        ? 'Shows Near You'
        : 'Shows at Venues Near You');

  const attendedHint =
    (payload?.recommendation_sources?.attended_artists ?? 0) > 0
      ? ' Includes artists from shows you have been to.'
      : '';

  const sectionSubtitle =
    sectionSubtitleOverride ??
    (resolvedMode === 'favorite-artists'
      ? payload?.source === 'jambase'
        ? `Upcoming shows from JamBase for your favorite artists.${attendedHint}`
        : `Upcoming concerts from artists you love.${attendedHint}`
      : nearbyAreaLabel
        ? sectionTitleOverride === 'Upcoming Shows'
          ? `Shows after today near ${nearbyAreaLabel}`
          : `Upcoming shows at venues near ${nearbyAreaLabel}`
        : sectionTitleOverride === 'Upcoming Shows'
          ? 'Shows after today at venues near you'
          : 'Upcoming shows at venues near you from JamBase');

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
      return (
        <div className={headingVariant === 'page' ? '' : HOME_FEED_SECTION_CLASS}>
          {!hideHeader ? sectionHeader : null}
          <div className="glass-highlight rounded-xl p-8 text-center">
            <MapPin className="w-12 h-12 text-momentum-flare mx-auto mb-4" />
            <p className="text-gray-300 max-w-lg mx-auto leading-relaxed">
              {typeof payload?.message === 'string' && payload.message.length > 0
                ? payload.message
                : 'No upcoming shows found near your area right now.'}
            </p>
            {resolvedViewAllHref ? (
              <Link
                to={resolvedViewAllHref}
                className="inline-block mt-4 text-sm text-momentum-flare hover:text-momentum-flare/80"
              >
                {viewAllLabel}
              </Link>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div className="glass-highlight rounded-xl p-8">
        <div className="text-center">
          <Heart className="w-12 h-12 text-momentum-rose mx-auto mb-4" />
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

  const visibleJbEvents =
    resolvedMode === 'nearby' ? jbEvents : jbEvents.slice(0, carouselMaxEvents);
  const visibleD1Concerts =
    resolvedMode === 'nearby' ? d1Concerts : d1Concerts.slice(0, carouselMaxEvents);
  const hasMoreShows =
    resolvedMode === 'nearby'
      ? jbEvents.length >= nearbyFetchLimit && nearbyFetchLimit < 40
      : jbEvents.length > carouselMaxEvents || d1Concerts.length > carouselMaxEvents;

  return (
    <div className={headingVariant === 'page' ? '' : HOME_FEED_SECTION_CLASS}>
      {!hideHeader ? sectionHeader : null}

      {jbEvents.length > 0 ? (
        <JamBaseEventGrid
          preloadedEvents={visibleJbEvents}
          maxEvents={visibleJbEvents.length || carouselMaxEvents}
          layout="carousel"
          carouselAriaLabel={carouselAriaLabel}
          carouselClassName={carouselBleed}
          onReachEnd={resolvedMode === 'nearby' ? loadMoreNearby : undefined}
        />
      ) : (
        <HorizontalClipCarousel
          stretchItems
          ariaLabel="Upcoming concerts from your favorite artists"
          className={carouselBleed}
          filmstrip={false}
        >
          {visibleD1Concerts.map((concert) => (
            <HorizontalClipCarouselItem key={concert.id} mobilePeek="event">
              <D1ConcertCard concert={concert} />
            </HorizontalClipCarouselItem>
          ))}
        </HorizontalClipCarousel>
      )}

      {hasShows && (resolvedViewAllHref || hasMoreShows) ? (
        <CarouselFeedFooter
          loading={loadingMore}
          hasMore={hasMoreShows}
          viewAllHref={resolvedViewAllHref}
          viewAllLabel={viewAllLabel}
          showEndMessage={false}
        />
      ) : null}
    </div>
  );
}
