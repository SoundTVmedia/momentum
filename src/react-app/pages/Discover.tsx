import { useState, useEffect } from 'react';
import { Search, MapPin, Music, Filter, Users, Video, X, Ticket } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import UserAvatar from '@/react-app/components/UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import DiscoverSectionTitle from '@/react-app/components/DiscoverSectionTitle';
import DiscoverArtistCarousel, {
  type DiscoverArtist,
} from '@/react-app/components/DiscoverArtistCarousel';
import { venuePath } from '@/shared/app-paths';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';

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
  jambase?: {
    artists: Record<string, unknown>[];
    venues: Record<string, unknown>[];
    events: Record<string, unknown>[];
  };
  jambaseNotice?: string | null;
}

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
};


const FALLBACK_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop';

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

export default function DiscoverPage() {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (searchQuery.trim()) {
      void performSearch();
    } else {
      setResults(null);
      void fetchDiscoverFeed();
    }
  }, [searchQuery, filters]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        ...filters,
      });

      const response = await fetch(`/api/search/advanced?${params}`);
      if (response.ok) {
        const data = (await response.json()) as SearchResults;
        setResults(data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoverFeed = async () => {
    setLoading(true);
    try {
      const [feedRes, nearbyRes] = await Promise.all([
        apiFetch('/api/discover/feed', { credentials: 'include' }),
        apiFetch('/api/shows/nearby?limit=20', { credentials: 'include' }),
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search artists, venues, cities..."
                className="w-full pl-14 pr-32 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint text-lg"
              />
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="absolute right-20 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 momentum-grad-interactive rounded-lg text-white font-medium hover:scale-105 transition-transform"
              >
                Search
              </button>
            </div>
          </form>

          {showFilters && (
            <div className="w-full mt-4 p-6 bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">Filters</h3>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Genre</label>
                  <select
                    value={filters.genre}
                    onChange={(e) => updateFilter('genre', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-mint"
                  >
                    <option value="">All Genres</option>
                    <option value="Rock">Rock</option>
                    <option value="Pop">Pop</option>
                    <option value="Hip-Hop">Hip-Hop</option>
                    <option value="Electronic">Electronic</option>
                    <option value="Jazz">Jazz</option>
                    <option value="Country">Country</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Time Range</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => updateFilter('dateRange', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-mint"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Sort By</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-mint"
                  >
                    <option value="latest">Latest</option>
                    <option value="trending">Trending</option>
                    <option value="most_liked">Most Liked</option>
                    <option value="most_viewed">Most Viewed</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results ? (
          <div className="space-y-12">
            {results.jambaseNotice && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-amber-100 text-sm max-w-3xl mx-auto">
                {results.jambaseNotice}
              </div>
            )}

            {results.clips.length > 0 && (
              <div>
                <DiscoverSectionTitle icon={Video} title="Clips" />
                <ClipFeedCarousel
                  clips={results.clips}
                  onOpenClip={(clip) => openDiscoverClip(clip, results.clips)}
                  ariaLabel="Search result clips"
                />
              </div>
            )}

            {results.artists.length > 0 && (
              <div>
                <DiscoverSectionTitle icon={Music} iconClassName="text-purple-400" title="Artists" />
                <DiscoverArtistCarousel
                  artists={results.artists.map((a) => ({
                    name: a.name,
                    image_url: a.image_url,
                    clip_count: a.clip_count,
                    jambase_id: a.jambase_id ?? null,
                  }))}
                />
              </div>
            )}

            {results.venues.length > 0 && (
              <div>
                <DiscoverSectionTitle icon={MapPin} iconClassName="text-blue-400" title="Venues" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {results.venues.map((venue) => (
                    <button
                      key={venue.jambase_id ?? venue.name}
                      type="button"
                      onClick={() => navigate(venuePath(venue.name))}
                      className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-400/50 transition-all text-left group"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <img
                          src={venue.image_url?.trim() || FALLBACK_VENUE_IMAGE}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="flex items-center gap-1.5 text-white font-semibold text-sm truncate">
                            <MapPin className="w-4 h-4 text-blue-300 shrink-0" aria-hidden />
                            <span className="truncate">{venue.name}</span>
                          </div>
                          {venue.location && (
                            <p className="text-gray-300 text-xs mt-0.5 truncate">{venue.location}</p>
                          )}
                          <p className="text-gray-400 text-xs mt-0.5">
                            {venue.clip_count} clip{venue.clip_count === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.jambase &&
              (results.jambase.artists.length > 0 ||
                results.jambase.venues.length > 0 ||
                results.jambase.events.length > 0) && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-950/10 p-6 space-y-10">
                <DiscoverSectionTitle
                  icon={Ticket}
                  iconClassName="text-amber-400"
                  title="JamBase directory"
                  subtitle="Powered by JamBase"
                />

                {results.jambase.artists.length > 0 && (
                  <DiscoverArtistCarousel
                    artists={results.jambase.artists.map((a) => {
                      const name = typeof a.name === 'string' ? a.name : 'Artist';
                      const image = typeof a.image === 'string' ? a.image : null;
                      return {
                        name,
                        image_url: image,
                        clip_count: 0,
                        jambase_id:
                          typeof a.identifier === 'string' ? a.identifier : null,
                      };
                    })}
                  />
                )}

                {results.jambase.venues.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-200/90 uppercase tracking-wide mb-3 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Venues
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {results.jambase.venues.map((v) => {
                        const name = typeof v.name === 'string' ? v.name : 'Venue';
                        const image = typeof v.image === 'string' ? v.image : null;
                        const addr = v.address as Record<string, unknown> | undefined;
                        const region = addr?.addressRegion as Record<string, unknown> | undefined;
                        const locality =
                          typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
                        const regionName =
                          typeof region?.alternateName === 'string'
                            ? region.alternateName
                            : typeof region?.name === 'string'
                              ? String(region.name)
                              : '';
                        const locationLine = [locality, regionName].filter(Boolean).join(', ');
                        return (
                          <button
                            key={typeof v.identifier === 'string' ? v.identifier : name}
                            type="button"
                            onClick={() => navigate(venuePath(name))}
                            className="bg-black/40 backdrop-blur-lg border border-amber-500/25 rounded-xl overflow-hidden hover:border-amber-400/50 transition-all text-left group"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden">
                              <img
                                src={image?.trim() || FALLBACK_VENUE_IMAGE}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <div className="text-white font-semibold text-sm truncate">{name}</div>
                                {locationLine ? (
                                  <p className="text-gray-300 text-xs mt-0.5 truncate">{locationLine}</p>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {results.jambase.events.length > 0 && (
                  <JamBaseEventGrid
                    layout="carousel"
                    preloadedEvents={results.jambase.events}
                    maxEvents={20}
                    carouselAriaLabel="JamBase search events"
                  />
                )}
              </div>
            )}

            {results.users.length > 0 && (
              <div>
                <DiscoverSectionTitle icon={Users} iconClassName="text-green-400" title="Users" />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {results.users.map((u) => (
                    <button
                      key={u.mocha_user_id}
                      type="button"
                      onClick={() => navigate(`/users/${u.mocha_user_id}`)}
                      className="bg-black/40 backdrop-blur-lg border border-green-500/20 rounded-xl p-4 hover:border-green-400/50 transition-all text-center"
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
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : discoverFeed ? (
          <div className="space-y-10 md:space-y-8">
            {discoverFeed.jambaseNotice && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-amber-100 text-sm">
                {discoverFeed.jambaseNotice}
              </div>
            )}

            {discoverFeed.clips.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle
                  title="Trending Clips"
                  subtitle="What the community is watching this week"
                />
                <ClipFeedCarousel
                  clips={discoverFeed.clips}
                  onOpenClip={(clip) => openDiscoverClip(clip, discoverFeed.clips)}
                  ariaLabel="Trending clips"
                />
              </section>
            )}

            {discoverFeed.artists.length > 0 && (
              <section className={HOME_FEED_SECTION_CLASS}>
                <DiscoverSectionTitle
                  title="Trending Artists"
                  subtitle="Artists with the most new clips — photos from JamBase when available"
                />
                <DiscoverArtistCarousel artists={discoverFeed.artists} />
              </section>
            )}

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
                <div className="rounded-xl border border-momentum-teal/25 bg-black/40 px-6 py-10 text-center">
                  <p className="text-gray-300 text-sm max-w-lg mx-auto">
                    {discoverFeed.jambaseNotice?.trim() ||
                      'No upcoming shows found near your area right now. Try again later or search for an artist or venue above.'}
                  </p>
                </div>
              )}
            </section>
          </div>
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
