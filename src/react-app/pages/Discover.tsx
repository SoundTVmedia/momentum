import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Music } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/react';
import { closeOutline, optionsOutline } from 'ionicons/icons';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import UserAvatar from '@/react-app/components/UserAvatar';
import { PeopleFollowButton } from '@/react-app/components/FollowSearchActionLabel';
import { useFollow } from '@/react-app/hooks/useFollow';
import type { ClipWithUser } from '@/shared/types';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import DiscoverSectionTitle from '@/react-app/components/DiscoverSectionTitle';
import DiscoverArtistCarousel, {
  type DiscoverArtist,
} from '@/react-app/components/DiscoverArtistCarousel';
import DiscoverVenueCarousel, {
  discoverVenueFromJamBase,
} from '@/react-app/components/DiscoverVenueCarousel';
import PastShowsCarousel from '@/react-app/components/PastShowsCarousel';
import DiscoverTrendingMusicSection from '@/react-app/components/DiscoverTrendingMusicSection';
import DiscoverSearchGeoBanner from '@/react-app/components/DiscoverSearchGeoBanner';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { nearbyShowsApiUrl, readDeviceCoordsForNearbyShows } from '@/react-app/lib/nearby-shows-url';
import { fetchAdvancedSearch } from '@/react-app/lib/fetch-advanced-search';
import { globalSongPath } from '@/shared/app-paths';
import { isJamBaseFestivalEvent } from '@/shared/jambase-festival';
import { jamBaseEventArtistName, jamBaseEventHeadliner, jamBaseEventId, jamBaseEventImageUrl, jamBaseEventVenueCityLine, jamBaseEventVenueName } from '@/shared/jambase-events';
import { jamBaseEventUpcomingOrInProgress } from '@/shared/jambase-event-day';
import {
  discoverResultsAreVenueIntent,
  jamBaseSearchRecordName,
  normalizeSearchName,
  searchQueryTargetsName,
} from '@/shared/discover-search-intent';
import { displayNamesClose } from '@/shared/artist-name-match';
import { isUsablePosterImageUrl } from '@/shared/clip-poster-url';
import {
  peekCachedAdvancedSearch,
  setCachedAdvancedSearch,
  type AdvancedSearchCacheOpts,
} from '@/react-app/lib/advanced-search-cache';
import { HOME_FEED_SECTION_CLASS, PAGE_SECTION_STACK_CLASS } from '@/react-app/lib/homeFeedLayout';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';

const DISCOVER_SEARCH_DEBOUNCE_MS = 280;
/** Mobile trending carousel unchanged; md+ shows one more tile in the row. */
const TRENDING_ARTISTS_MOBILE_COUNT = 4;
const TRENDING_ARTISTS_DESKTOP_COUNT = 5;

interface SearchResults {
  clips: ClipWithUser[];
  artists: {
    name: string;
    image_url: string | null;
    clip_count: number;
    jambase_id?: string | null;
  }[];
  venues: {
    name: string;
    location: string | null;
    clip_count: number;
    image_url: string | null;
    jambase_id?: string | null;
  }[];
  users: {
    mocha_user_id: string;
    display_name: string | null;
    profile_image_url: string | null;
    clip_count: number;
  }[];
  songs?: {
    slug: string;
    title: string;
    artist_name: string | null;
    clip_count: number;
  }[];
  pastShows?: {
    event_title: string;
    artist_name: string;
    show_date: string;
    show_id?: string | null;
    venue_name?: string | null;
    venue_location?: string | null;
    jambase_event_id?: string | null;
    jambase_venue_id?: string | null;
    jambase_artist_id?: string | null;
    clip_count: number;
    average_show_rating?: number;
    thumbnail_url: string | null;
    artist_image_url?: string | null;
  }[];
  jambase?: {
    artists: Record<string, unknown>[];
    venues: Record<string, unknown>[];
    events: Record<string, unknown>[];
  };
  jambaseNotice?: string | null;
  locationScoped?: boolean;
  searchGeo?: { label: string; radius_miles: number };
}

function jamBaseArtistImageFromRecord(record: Record<string, unknown> | null | undefined): string | null {
  const image = typeof record?.image === 'string' ? record.image.trim() : '';
  return isUsablePosterImageUrl(image) ? image : null;
}

function discoverArtistImageUrl(
  artistName: string,
  artists: SearchResults['artists'],
  jamBaseArtists: Record<string, unknown>[],
): string | null {
  const name = artistName.trim();
  if (!name) return null;
  const fromSearch = artists.find(
    (artist) =>
      normalizeSearchName(artist.name) === normalizeSearchName(name) ||
      displayNamesClose(artist.name, name),
  );
  if (isUsablePosterImageUrl(fromSearch?.image_url)) return fromSearch!.image_url;
  const fromCatalog = jamBaseArtists.find((artist) => {
    const catalogName = jamBaseSearchRecordName(artist);
    return (
      normalizeSearchName(catalogName) === normalizeSearchName(name) ||
      displayNamesClose(catalogName, name)
    );
  });
  return jamBaseArtistImageFromRecord(fromCatalog);
}

type DiscoverPastShow = NonNullable<SearchResults['pastShows']>[number];

function pastShowDedupeKey(show: DiscoverPastShow): string {
  return (
    (show.show_id || show.jambase_event_id || '').trim() ||
    `${show.artist_name}|${show.venue_name ?? ''}|${show.show_date}`
  );
}

function jamBaseClipEventToPastShow(event: Record<string, unknown>): DiscoverPastShow | null {
  if (isJamBaseFestivalEvent(event) || jamBaseEventUpcomingOrInProgress(event)) return null;
  const clipCount = Number(event['x-clipCount']) || 0;
  const eventTitle = typeof event.name === 'string' ? event.name.trim() : '';
  const artistName = jamBaseEventArtistName(event);
  const showDate = typeof event.startDate === 'string' ? event.startDate.trim() : '';
  if (!eventTitle || !artistName || !showDate) return null;
  const loc = event.location as Record<string, unknown> | undefined;
  const venueName = jamBaseEventVenueName(event);
  const image = jamBaseEventImageUrl(event);
  const artistImage = jamBaseArtistImageFromRecord(jamBaseEventHeadliner(event));
  const feedbackId =
    typeof event['x-feedbackShowId'] === 'string' ? event['x-feedbackShowId'].trim() : '';
  return {
    event_title: eventTitle,
    artist_name: artistName,
    show_date: showDate,
    show_id: feedbackId || jamBaseEventId(event) || null,
    venue_name: venueName === 'Venue TBA' ? null : venueName,
    venue_location: jamBaseEventVenueCityLine(event) || null,
    jambase_event_id: jamBaseEventId(event) || null,
    jambase_venue_id: typeof loc?.identifier === 'string' ? loc.identifier : null,
    clip_count: clipCount,
    thumbnail_url: isUsablePosterImageUrl(image) ? image : artistImage,
    artist_image_url: artistImage,
  };
}

function mergeDiscoverPastShows(rows: DiscoverPastShow[]): DiscoverPastShow[] {
  const byKey = new Map<string, DiscoverPastShow>();
  for (const row of rows) {
    const key = pastShowDedupeKey(row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingThumb = isUsablePosterImageUrl(existing.thumbnail_url)
      ? existing.thumbnail_url
      : null;
    const nextThumb = isUsablePosterImageUrl(row.thumbnail_url) ? row.thumbnail_url : existingThumb;
    const existingArtistImage = isUsablePosterImageUrl(existing.artist_image_url)
      ? existing.artist_image_url
      : null;
    const nextArtistImage = isUsablePosterImageUrl(row.artist_image_url)
      ? row.artist_image_url
      : existingArtistImage;
    byKey.set(key, {
      ...existing,
      ...row,
      clip_count: Math.max(existing.clip_count, row.clip_count),
      thumbnail_url: nextThumb,
      artist_image_url: nextArtistImage,
    });
  }
  return [...byKey.values()].sort((a, b) =>
    String(b.show_date).localeCompare(String(a.show_date)),
  );
}

function clipBackedPastShowsForDiscover(data: SearchResults): DiscoverPastShow[] {
  const fromEvents = (data.jambase?.events ?? [])
    .map(jamBaseClipEventToPastShow)
    .filter((row): row is DiscoverPastShow => row != null);
  return mergeDiscoverPastShows([...(data.pastShows ?? []), ...fromEvents]).map((show) => {
    if (isUsablePosterImageUrl(show.artist_image_url)) return show;
    const artistImage = discoverArtistImageUrl(
      show.artist_name,
      data.artists,
      (data.jambase?.artists ?? []).filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      ),
    );
    return artistImage ? { ...show, artist_image_url: artistImage } : show;
  });
}

type DiscoverForYou = {
  clips: ClipWithUser[];
  personalized: boolean;
  subtitle: string;
};

type DiscoverFeed = {
  clips: ClipWithUser[];
  artists: DiscoverArtist[];
  nearbyEvents: Record<string, unknown>[];
  location: {
    latitude: number;
    longitude: number;
    source: 'profile' | 'ip' | 'default';
    label?: string;
  };
  jambaseNotice?: string | null;
  forYou?: DiscoverForYou | null;
};


function nearbyShowsSubtitle(feed: DiscoverFeed): string {
  const loc = feed.location.label?.trim();
  if (loc) {
    return `Upcoming JamBase listings near ${loc}`;
  }
  if (feed.location.source === 'profile') {
    return 'Upcoming shows near your home location';
  }
  if (feed.location.source === 'ip') {
    return 'Upcoming shows near you (based on your area)';
  }
  return 'Upcoming shows in your area';
}

function discoverHasActiveQuery(params: URLSearchParams): boolean {
  const q = params.get('q')?.trim();
  if (q) return true;
  return ['genre', 'location', 'dateRange', 'sortBy'].some((key) => {
    const value = params.get(key)?.trim();
    if (!value) return false;
    if (key === 'dateRange' && value === '30d') return false;
    if (key === 'sortBy' && value === 'latest') return false;
    return true;
  });
}

function discoverShowsSearchOnly(params: URLSearchParams): boolean {
  return params.get('focus') === '1' || discoverHasActiveQuery(params);
}

function discoverVenueIntent(query: string, data: SearchResults): boolean {
  return discoverResultsAreVenueIntent(query, data);
}

function targetedDiscoverArtistNames(query: string, data: SearchResults): string[] {
  const names = [
    ...data.artists
      .filter((artist) => searchQueryTargetsName(query, artist.name))
      .map((artist) => artist.name),
    ...(data.songs ?? [])
      .filter((song) => searchQueryTargetsName(query, song.title) && song.artist_name?.trim())
      .map((song) => song.artist_name!.trim()),
  ];
  return [...new Set(names)];
}

function targetedDiscoverVenues(query: string, data: SearchResults) {
  return data.venues.filter((venue) => searchQueryTargetsName(query, venue.name));
}

function targetedJamBaseVenues(query: string, data: SearchResults): Record<string, unknown>[] {
  return (data.jambase?.venues ?? []).filter((venue) =>
    searchQueryTargetsName(query, jamBaseSearchRecordName(venue)),
  );
}

function upcomingShowsForDiscover(
  query: string,
  data: SearchResults,
): Record<string, unknown>[] {
  const events = (data.jambase?.events ?? []).filter(
    (event) => !isJamBaseFestivalEvent(event) && jamBaseEventUpcomingOrInProgress(event),
  );
  if (discoverVenueIntent(query, data)) {
    const venueNames = [
      ...targetedDiscoverVenues(query, data).map((venue) => venue.name),
      ...targetedJamBaseVenues(query, data).map(jamBaseSearchRecordName),
    ];
    if (venueNames.length === 0) return events;
    return events.filter((event) => {
      const venue = jamBaseEventVenueName(event);
      return (
        searchQueryTargetsName(query, venue) ||
        venueNames.some((name) => displayNamesClose(name, venue))
      );
    });
  }
  const artists = targetedDiscoverArtistNames(query, data);
  if (artists.length === 0) return events;
  return events.filter((event) => {
    const performer = jamBaseEventArtistName(event);
    return artists.some((name) => searchQueryTargetsName(name, performer) || searchQueryTargetsName(query, performer));
  });
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const isMobileViewport = useIsMobileViewport();
  const { toggleFollow, isFollowing, isLoading: isFollowLoading, hydrated: followHydrated } =
    useFollow();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [discoverFeed, setDiscoverFeed] = useState<DiscoverFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [discoverModalFeed, setDiscoverModalFeed] = useState<ClipWithUser[] | null>(null);

  const openDiscoverClip = (clip: ClipWithUser, list: ClipWithUser[]) => {
    setSelectedClip(clip);
    setDiscoverModalFeed(list.length > 1 ? list : null);
  };

  const closeDiscoverClipModal = () => {
    setSelectedClip(null);
    setDiscoverModalFeed(null);
  };

  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    genre: searchParams.get('genre') || '',
    location: searchParams.get('location') || '',
    dateRange: searchParams.get('dateRange') || '30d',
    sortBy: searchParams.get('sortBy') || 'latest',
  });

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [geoSearchRadius, setGeoSearchRadius] = useState(50);
  const [isGeoSearch, setIsGeoSearch] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), DISCOVER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (results?.locationScoped) {
      setIsGeoSearch(true);
      if (results.searchGeo?.radius_miles) {
        setGeoSearchRadius(results.searchGeo.radius_miles);
      }
    } else if (results && !results.locationScoped) {
      setIsGeoSearch(false);
    }
  }, [results]);

  const buildSearchCacheOpts = useCallback(
    (compact?: boolean): AdvancedSearchCacheOpts => ({
      compact,
      radiusMiles: isGeoSearch ? geoSearchRadius : undefined,
      location: filters.location,
      dateRange: filters.dateRange,
      sortBy: filters.sortBy,
      genre: filters.genre,
    }),
    [
      isGeoSearch,
      geoSearchRadius,
      filters.location,
      filters.dateRange,
      filters.sortBy,
      filters.genre,
    ],
  );

  const performSearch = useCallback(async (q: string, radiusOverride?: number) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const radiusForFetch =
      radiusOverride ?? (isGeoSearch ? geoSearchRadius : undefined);
    const fullCacheOpts = buildSearchCacheOpts(false);
    if (radiusForFetch != null) {
      fullCacheOpts.radiusMiles = radiusForFetch;
    }
    const compactCacheOpts = buildSearchCacheOpts(true);
    if (radiusForFetch != null) {
      compactCacheOpts.radiusMiles = radiusForFetch;
    }

    const cached = peekCachedAdvancedSearch(trimmed, fullCacheOpts);
    if (cached) {
      setResults(cached as SearchResults);
      setLoading(false);
    } else {
      setLoading(true);
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const fetchOpts = {
      signal: controller.signal,
      location: filters.location,
      dateRange: filters.dateRange,
      sortBy: filters.sortBy,
      genre: filters.genre,
      radiusMiles: radiusForFetch,
    };

    try {
      if (!cached) {
        const compactData = await fetchAdvancedSearch(trimmed, {
          ...fetchOpts,
          compact: true,
        });
        if (controller.signal.aborted) return;
        setResults(compactData as SearchResults);
        setCachedAdvancedSearch(trimmed, compactData, compactCacheOpts);
        setLoading(false);
      }

      const fullData = await fetchAdvancedSearch(trimmed, fetchOpts);
      if (controller.signal.aborted) return;
      setResults(fullData as SearchResults);
      setCachedAdvancedSearch(trimmed, fullData, fullCacheOpts);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Search failed:', error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    buildSearchCacheOpts,
    filters.dateRange,
    filters.location,
    filters.sortBy,
    filters.genre,
    geoSearchRadius,
    isGeoSearch,
  ]);

  const handleGeoRadiusApplied = useCallback(
    (radius: number) => {
      setGeoSearchRadius(radius);
      setIsGeoSearch(true);
      if (debouncedQuery.trim()) {
        void performSearch(debouncedQuery, radius);
      }
    },
    [debouncedQuery, performSearch],
  );

  const searchOnlyMode = searchParams.get('focus') === '1' && !discoverHasActiveQuery(searchParams);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      void performSearch(debouncedQuery);
    } else {
      searchAbortRef.current?.abort();
      setResults(null);
      setIsGeoSearch(false);
      if (searchOnlyMode) {
        setDiscoverFeed(null);
        setLoading(false);
      } else {
        void fetchDiscoverFeed();
      }
    }
  }, [debouncedQuery, filters, performSearch, searchOnlyMode]);

  const fetchDiscoverFeed = async () => {
    setLoading(true);
    try {
      const device = await readDeviceCoordsForNearbyShows();
      const [feedRes, nearbyRes] = await Promise.all([
        apiFetch('/api/discover/feed', { credentials: 'include' }),
        apiFetch(
          nearbyShowsApiUrl({
            limit: 20,
            latitude: device?.latitude,
            longitude: device?.longitude,
          }),
          { credentials: 'include' },
        ),
      ]);

      let feed: DiscoverFeed | null = null;
      if (feedRes.ok) {
        feed = (await feedRes.json()) as DiscoverFeed;
      }

      if (nearbyRes.ok) {
        const nearby = (await nearbyRes.json()) as {
          events?: Record<string, unknown>[];
          location?: DiscoverFeed['location'];
          jambaseNotice?: string | null;
        };
        const events = Array.isArray(nearby.events) ? nearby.events : [];
        const nearbyNotice =
          typeof nearby.jambaseNotice === 'string' && nearby.jambaseNotice.trim()
            ? nearby.jambaseNotice.trim()
            : null;
        if (feed) {
          feed = {
            ...feed,
            nearbyEvents: events.length > 0 ? events : feed.nearbyEvents,
            location: nearby.location ?? feed.location,
            jambaseNotice: feed.jambaseNotice ?? nearbyNotice,
          };
        } else {
          feed = {
            clips: [],
            artists: [],
            nearbyEvents: events,
            location: nearby.location ?? {
              latitude: 40.7505,
              longitude: -73.9934,
              source: 'default',
              label: 'New York, NY',
            },
            jambaseNotice: nearbyNotice,
          };
        }
      }

      if (feed) {
        setDiscoverFeed(feed);
      }
    } catch (error) {
      console.error('Failed to fetch discover feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setSearchParams(params);
  };

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!discoverShowsSearchOnly(searchParams)) {
    return <Navigate to="/" replace />;
  }

  const venueIntent = results ? discoverVenueIntent(debouncedQuery, results) : false;
  const upcomingShows = results ? upcomingShowsForDiscover(debouncedQuery, results) : [];
  const pastShows = results ? clipBackedPastShowsForDiscover(results) : [];
  const visibleVenues = (() => {
    if (!venueIntent || !results) return [];
    const d1 = targetedDiscoverVenues(debouncedQuery, results).map((venue) => ({
      name: venue.name,
      image_url: venue.image_url,
      location: venue.location,
      clip_count: venue.clip_count,
      jambase_id: venue.jambase_id ?? null,
    }));
    const seen = new Set(d1.map((venue) => normalizeSearchName(venue.name)));
    const jambase = targetedJamBaseVenues(debouncedQuery, results)
      .map(discoverVenueFromJamBase)
      .filter((venue) => {
        const key = normalizeSearchName(venue.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return [...d1, ...jambase];
  })();

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <form onSubmit={handleSearch} className="w-full">
            <div className="flex items-center gap-2">
              <IonSearchbar
                className="app-searchbar-hero min-w-0 flex-1"
                value={searchQuery}
                debounce={0}
                placeholder="Search artists, venues, shows, cities..."
                onIonInput={(e) => setSearchQuery(e.detail.value ?? '')}
              />
              <IonButtons>
                <IonButton
                  fill="clear"
                  color={showFilters ? 'primary' : 'medium'}
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label="Filters"
                >
                  <IonIcon slot="icon-only" icon={optionsOutline} />
                </IonButton>
                <IonButton type="submit" color="primary">
                  Search
                </IonButton>
              </IonButtons>
            </div>
          </form>

          {showFilters && (
            <div className="w-full mt-4 p-4 glass-panel border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-bold">Filters</h3>
                <IonButton
                  fill="clear"
                  color="medium"
                  onClick={() => setShowFilters(false)}
                  aria-label="Close filters"
                >
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              </div>

              <IonItem lines="none" className="rounded-xl">
                <IonSelect
                  label="Genre"
                  labelPlacement="stacked"
                  interface="popover"
                  value={filters.genre}
                  onIonChange={(e) => updateFilter('genre', String(e.detail.value ?? ''))}
                >
                  <IonSelectOption value="">All Genres</IonSelectOption>
                  <IonSelectOption value="Rock">Rock</IonSelectOption>
                  <IonSelectOption value="Pop">Pop</IonSelectOption>
                  <IonSelectOption value="Hip-Hop">Hip-Hop</IonSelectOption>
                  <IonSelectOption value="Electronic">Electronic</IonSelectOption>
                  <IonSelectOption value="Jazz">Jazz</IonSelectOption>
                  <IonSelectOption value="Country">Country</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" className="rounded-xl">
                <IonSelect
                  label="Time Range"
                  labelPlacement="stacked"
                  interface="popover"
                  value={filters.dateRange}
                  onIonChange={(e) => updateFilter('dateRange', String(e.detail.value ?? ''))}
                >
                  <IonSelectOption value="7d">Last 7 days</IonSelectOption>
                  <IonSelectOption value="30d">Last 30 days</IonSelectOption>
                  <IonSelectOption value="90d">Last 90 days</IonSelectOption>
                  <IonSelectOption value="all">All time</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" className="rounded-xl">
                <IonSelect
                  label="Sort By"
                  labelPlacement="stacked"
                  interface="popover"
                  value={filters.sortBy}
                  onIonChange={(e) => updateFilter('sortBy', String(e.detail.value ?? ''))}
                >
                  <IonSelectOption value="latest">Latest</IonSelectOption>
                  <IonSelectOption value="trending">Trending</IonSelectOption>
                  <IonSelectOption value="most_liked">Most Liked</IonSelectOption>
                  <IonSelectOption value="most_viewed">Most Viewed</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <IonSpinner className="app-spinner h-12 w-12" name="crescent" />
          </div>
        ) : results ? (
          <div className={PAGE_SECTION_STACK_CLASS}>
            {results.jambaseNotice && (
              <div className="rounded-xl border border-momentum-ember/40 bg-momentum-ink/50 px-4 py-3 text-momentum-glacier/95 text-sm max-w-3xl mx-auto">
                {results.jambaseNotice}
              </div>
            )}

            {results.searchGeo && (
              <DiscoverSearchGeoBanner
                label={results.searchGeo.label}
                radiusMiles={results.searchGeo.radius_miles}
                onRadiusApplied={handleGeoRadiusApplied}
              />
            )}

            {results.clips.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle title="Clips" />
                <ClipFeedCarousel
                  clips={results.clips}
                  onOpenClip={(clip, visible) => openDiscoverClip(clip, visible)}
                  ariaLabel="Search result clips"
                />
              </section>
            )}

            {results.artists.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle title="Artists" />
                <DiscoverArtistCarousel
                  artists={results.artists.map((a) => ({
                    name: a.name,
                    image_url: a.image_url,
                    clip_count: a.clip_count,
                    jambase_id: a.jambase_id ?? null,
                  }))}
                />
              </section>
            )}

            {visibleVenues.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle title="Venues" />
                <DiscoverVenueCarousel venues={visibleVenues} />
              </section>
            )}

            {pastShows.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle title="Past Shows" />
                <PastShowsCarousel
                  shows={pastShows}
                  variant={venueIntent ? 'venue' : 'artist'}
                />
              </section>
            )}

            {(results.songs ?? []).length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle icon={Music} title="Songs" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(results.songs ?? []).map((song) => (
                    <button
                      key={song.slug}
                      type="button"
                      onClick={() => navigate(globalSongPath(song.slug))}
                      className="glass-panel border border-white/10 rounded-xl p-4 text-left hover:border-momentum-flare/40 transition-all min-w-0"
                    >
                      <div className="text-white font-medium truncate">{song.title}</div>
                      {song.artist_name ? (
                        <div className="text-gray-400 text-xs truncate mt-1">{song.artist_name}</div>
                      ) : null}
                      {song.clip_count > 0 ? (
                        <div className="text-gray-500 text-xs mt-1">
                          {song.clip_count} clip{song.clip_count !== 1 ? 's' : ''}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {results.jambase && results.jambase.events.filter(isJamBaseFestivalEvent).length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle title="Festivals" />
                <JamBaseEventGrid
                  layout="carousel"
                  preloadedEvents={results.jambase.events.filter(isJamBaseFestivalEvent)}
                  maxEvents={20}
                  carouselAriaLabel="Search result festivals"
                />
              </section>
            )}

            {upcomingShows.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle title="Upcoming Shows" />
                <JamBaseEventGrid
                  layout="carousel"
                  preloadedEvents={upcomingShows}
                  maxEvents={20}
                  carouselAriaLabel="Upcoming shows matching this search"
                />
              </section>
            )}

            {results.users.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle icon={Users} iconClassName="text-green-400" title="Feedback Users" />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {results.users.map((u) => (
                    <div
                      key={u.mocha_user_id}
                      className="glass-panel border border-green-500/20 rounded-xl p-4 hover:border-green-400/50 transition-all text-center"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/users/${u.mocha_user_id}`)}
                        className="w-full"
                      >
                        <div className="flex justify-center mb-3">
                          <UserAvatar
                            imageUrl={u.profile_image_url}
                            displayName={u.display_name}
                            seed={u.mocha_user_id}
                            alt={u.display_name || 'User'}
                            sizeClass="w-20 h-20"
                            letterClassName="text-2xl font-semibold"
                          />
                        </div>
                        <div className="text-white font-medium text-sm truncate">
                          {u.display_name || 'Anonymous'}
                        </div>
                        <div className="text-gray-400 text-xs">{u.clip_count} clips</div>
                      </button>
                      <PeopleFollowButton
                        displayName={u.display_name}
                        following={isFollowing(u.mocha_user_id)}
                        loading={isFollowLoading(u.mocha_user_id)}
                        disabled={!followHydrated}
                        onToggle={() => void toggleFollow(u.mocha_user_id)}
                        className="mt-3 inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 hover:bg-white/15 disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : discoverFeed ? (
          <div className={PAGE_SECTION_STACK_CLASS}>
            {discoverFeed.jambaseNotice && (
              <div className="rounded-xl border border-momentum-ember/40 bg-momentum-ink/50 px-4 py-3 text-momentum-glacier/95 text-sm">
                {discoverFeed.jambaseNotice}
              </div>
            )}

            {discoverFeed.forYou && discoverFeed.forYou.clips.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle
                  title="For You"
                  subtitle={discoverFeed.forYou.subtitle}
                />
                <ClipFeedCarousel
                  clips={discoverFeed.forYou.clips}
                  onOpenClip={(clip, visible) => openDiscoverClip(clip, visible)}
                  ariaLabel="For you clips"
                />
              </section>
            )}

            {discoverFeed.clips.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle
                  title="Trending Clips"
                  subtitle="What the community is watching this week"
                />
                <ClipFeedCarousel
                  clips={discoverFeed.clips}
                  onOpenClip={(clip, visible) => openDiscoverClip(clip, visible)}
                  ariaLabel="Trending clips"
                />
              </section>
            )}

            <section className={HOME_FEED_SECTION_CLASS}>
              <DiscoverSectionTitle
                title="Trending Artists"
                subtitle="Artists with the most new clips"
              />
              {discoverFeed.artists.length > 0 ? (
                <DiscoverArtistCarousel
                  artists={discoverFeed.artists.slice(
                    0,
                    isMobileViewport
                      ? TRENDING_ARTISTS_MOBILE_COUNT
                      : TRENDING_ARTISTS_DESKTOP_COUNT,
                  )}
                />
              ) : (
                <p className="text-sm text-gray-400">
                  Trending artists will appear here as more clips are shared on the platform.
                </p>
              )}
            </section>

            <section className={HOME_FEED_SECTION_CLASS}>
              <DiscoverSectionTitle
                title="Upcoming Shows at Venues Near You"
                subtitle={nearbyShowsSubtitle(discoverFeed)}
              />
              {discoverFeed.nearbyEvents.length > 0 ? (
                <JamBaseEventGrid
                  layout="carousel"
                  preloadedEvents={discoverFeed.nearbyEvents}
                  maxEvents={20}
                  carouselAriaLabel="Upcoming shows near you"
                />
              ) : (
                <div className="rounded-xl border border-momentum-ember/25 bg-black/40 px-6 py-10 text-center">
                  <p className="text-gray-300 text-sm max-w-lg mx-auto">
                    {discoverFeed.jambaseNotice?.trim() ||
                      'No upcoming shows found near your area right now. Try again later or search for an artist or venue above.'}
                  </p>
                </div>
              )}
            </section>

            <DiscoverTrendingMusicSection />
          </div>
        ) : searchOnlyMode ? (
          <p className="text-center text-gray-400 py-12 text-sm max-w-md mx-auto">
            Search artists, venues, or cities to explore clips and upcoming shows.
          </p>
        ) : null}
      </div>

      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={closeDiscoverClipModal}
          feedNavigation={
            discoverModalFeed && discoverModalFeed.length > 1
              ? { clips: discoverModalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      )}
    </div>
  );
}
