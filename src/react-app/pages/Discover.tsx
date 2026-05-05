import { useState, useEffect } from 'react';
import { Search, TrendingUp, MapPin, Music, Filter, Users, Video, X, Ticket } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import TicketmasterEventGrid from '@/react-app/components/TicketmasterEventGrid';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import PremiumCTA from '@/react-app/components/PremiumCTA';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { artistPath, venuePath } from '@/shared/app-paths';

interface SearchResults {
  clips: ClipWithUser[];
  artists: { name: string; image_url: string | null; clip_count: number }[];
  venues: { name: string; location: string | null; clip_count: number }[];
  users: { mocha_user_id: string; display_name: string | null; profile_image_url: string | null; clip_count: number }[];
  jambase?: {
    artists: Record<string, unknown>[];
    venues: Record<string, unknown>[];
    events: Record<string, unknown>[];
  };
}

function jamBaseEventTicket(ev: Record<string, unknown>): string | null {
  const offers = ev.offers;
  if (!Array.isArray(offers) || offers.length === 0) {
    return typeof ev.url === 'string' ? ev.url : null;
  }
  const primary = offers.find(
    (o: unknown) =>
      typeof o === 'object' &&
      o !== null &&
      (o as Record<string, unknown>).category === 'ticketingLinkPrimary'
  ) as Record<string, unknown> | undefined;
  const u = (primary?.url ?? (offers[0] as Record<string, unknown>)?.url) as string | undefined;
  return typeof u === 'string' ? u : null;
}

function jamBaseEventHeadlinerName(ev: Record<string, unknown>): string | null {
  const p = ev.performer;
  if (!Array.isArray(p) || p.length === 0) return null;
  const head = p.find(
    (x: unknown) =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>)['x-isHeadliner'] === true
  ) as Record<string, unknown> | undefined;
  const pick = head ?? (p[0] as Record<string, unknown>);
  return typeof pick?.name === 'string' ? pick.name : null;
}

function jamBaseEventVenueName(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.name === 'string' ? loc.name : null;
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    genre: searchParams.get('genre') || '',
    location: searchParams.get('location') || '',
    dateRange: searchParams.get('dateRange') || '30d',
    sortBy: searchParams.get('sortBy') || 'latest',
  });

  const [trendingContent, setTrendingContent] = useState<{
    artists: any[];
    venues: any[];
    clips: ClipWithUser[];
  } | null>(null);
  const [showLiveEvents, setShowLiveEvents] = useState(false);
  const [liveEventCatalog, setLiveEventCatalog] = useState<'jambase' | 'ticketmaster'>('jambase');

  useEffect(() => {
    if (searchQuery) {
      performSearch();
    } else {
      fetchTrendingContent();
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
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingContent = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/discover/trending');
      if (response.ok) {
        const data = await response.json();
        setTrendingContent(data);
      }
    } catch (error) {
      console.error('Failed to fetch trending content:', error);
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
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 text-center">
            Find <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Your Next Show</span>
          </h1>
          
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search artists, venues, cities..."
                className="w-full pl-14 pr-32 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-lg"
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
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-medium hover:scale-105 transition-transform"
              >
                Search
              </button>
            </div>
          </form>

          {/* Filters Panel */}
          {showFilters && (
            <div className="max-w-3xl mx-auto mt-4 p-6 bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">Filters</h3>
                <button
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
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
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
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
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
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="latest">Latest</option>
                    <option value="trending">Trending</option>
                    <option value="most_liked">Most Liked</option>
                    <option value="most_viewed">Most Viewed</option>
                    <option value="top_rated">Top Rated</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results or Trending Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : results ? (
          <div className="space-y-12">
            {/* Clips Results */}
            {results.clips.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-6">
                  <Video className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-2xl font-bold text-white">Clips</h2>
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-sm rounded-full">
                    {results.clips.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.clips.map((clip, index) => (
                    <div
                      key={clipListItemKey(clip, index)}
                      onClick={() => setSelectedClip(clip)}
                      className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/50 transition-all cursor-pointer group"
                    >
                      <div className="relative aspect-video">
                        <img
                          src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                          alt="Concert moment"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-4">
                        {clip.artist_name && (
                          <div className="font-bold text-purple-400 mb-1">{clip.artist_name}</div>
                        )}
                        {clip.content_description && (
                          <p className="text-gray-300 text-sm line-clamp-2">{clip.content_description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artists Results */}
            {results.artists.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-6">
                  <Music className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white">Artists</h2>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full">
                    {results.artists.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {results.artists.map((artist) => (
                    <button
                      key={artist.name}
                      onClick={() => navigate(artistPath(artist.name))}
                      className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/50 transition-all text-center"
                    >
                      <img
                        src={artist.image_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'}
                        alt={artist.name}
                        className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                      />
                      <div className="text-white font-medium text-sm truncate">{artist.name}</div>
                      <div className="text-gray-400 text-xs">{artist.clip_count} clips</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Venues Results */}
            {results.venues.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-6">
                  <MapPin className="w-6 h-6 text-blue-400" />
                  <h2 className="text-2xl font-bold text-white">Venues</h2>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
                    {results.venues.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.venues.map((venue) => (
                    <button
                      key={venue.name}
                      onClick={() => navigate(venuePath(venue.name))}
                      className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-4 hover:border-blue-400/50 transition-all text-left"
                    >
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-8 h-8 text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{venue.name}</div>
                          {venue.location && (
                            <div className="text-gray-400 text-sm truncate">{venue.location}</div>
                          )}
                          <div className="text-gray-500 text-xs mt-1">{venue.clip_count} clips</div>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Ticket className="w-6 h-6 text-amber-400" />
                    <h2 className="text-2xl font-bold text-white">JamBase directory</h2>
                  </div>
                  <a
                    href="https://www.jambase.com"
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="text-xs text-amber-200/80 hover:text-amber-100 underline"
                  >
                    Powered by JamBase
                  </a>
                </div>

                {results.jambase.artists.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                      <Music className="w-5 h-5 text-purple-400" />
                      <span>Artists</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {results.jambase.artists.map((a) => {
                        const name = typeof a.name === 'string' ? a.name : 'Artist';
                        const image = typeof a.image === 'string' ? a.image : null;
                        return (
                          <button
                            key={typeof a.identifier === 'string' ? a.identifier : name}
                            type="button"
                            onClick={() => navigate(artistPath(name))}
                            className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/50 transition-all text-center"
                          >
                            <img
                              src={
                                image ||
                                'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'
                              }
                              alt={name}
                              className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                            />
                            <div className="text-white font-medium text-sm truncate">{name}</div>
                            <div className="text-amber-200/70 text-xs">JamBase</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {results.jambase.venues.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                      <MapPin className="w-5 h-5 text-blue-400" />
                      <span>Venues</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {results.jambase.venues.map((v) => {
                        const name = typeof v.name === 'string' ? v.name : 'Venue';
                        const addr = v.address as Record<string, unknown> | undefined;
                        const city =
                          typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
                        const region = addr?.addressRegion as Record<string, unknown> | undefined;
                        const st =
                          typeof region?.alternateName === 'string'
                            ? region.alternateName
                            : typeof region?.name === 'string'
                              ? (region.name as string)
                              : '';
                        const loc = [city, st].filter(Boolean).join(', ');
                        return (
                          <button
                            key={typeof v.identifier === 'string' ? v.identifier : name}
                            type="button"
                            onClick={() => navigate(venuePath(name))}
                            className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-4 hover:border-blue-400/50 transition-all text-left"
                          >
                            <div className="text-white font-medium truncate">{name}</div>
                            {loc ? (
                              <div className="text-gray-400 text-sm truncate">{loc}</div>
                            ) : null}
                            <div className="text-amber-200/70 text-xs mt-1">JamBase</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {results.jambase.events.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                      <Ticket className="w-5 h-5 text-cyan-400" />
                      <span>Upcoming shows</span>
                    </h3>
                    <div className="space-y-3">
                      {results.jambase.events.map((ev) => {
                        const id = typeof ev.identifier === 'string' ? ev.identifier : String(ev.startDate);
                        const title = typeof ev.name === 'string' ? ev.name : 'Show';
                        const head = jamBaseEventHeadlinerName(ev);
                        const venueNm = jamBaseEventVenueName(ev);
                        const ticket = jamBaseEventTicket(ev);
                        const start = typeof ev.startDate === 'string' ? ev.startDate : '';
                        return (
                          <div
                            key={id}
                            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-black/40 border border-white/10"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium truncate">{title}</div>
                              <div className="text-sm text-gray-400">
                                {start && new Date(start).toLocaleString()}
                                {head ? ` · ` : ''}
                                {head ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate(artistPath(head))}
                                    className="text-purple-300 hover:underline"
                                  >
                                    {head}
                                  </button>
                                ) : null}
                                {venueNm ? ` @ ` : ''}
                                {venueNm ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate(venuePath(venueNm))}
                                    className="text-blue-300 hover:underline"
                                  >
                                    {venueNm}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {ticket ? (
                              <a
                                href={ticket}
                                target="_blank"
                                rel="nofollow noopener noreferrer"
                                className="shrink-0 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-medium text-center"
                              >
                                Tickets
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Users Results */}
            {results.users.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-6">
                  <Users className="w-6 h-6 text-green-400" />
                  <h2 className="text-2xl font-bold text-white">Users</h2>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                    {results.users.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {results.users.map((user) => (
                    <button
                      key={user.mocha_user_id}
                      onClick={() => navigate(`/users/${user.mocha_user_id}`)}
                      className="bg-black/40 backdrop-blur-lg border border-green-500/20 rounded-xl p-4 hover:border-green-400/50 transition-all text-center"
                    >
                      <img
                        src={user.profile_image_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=100&h=100&fit=crop&crop=face'}
                        alt={user.display_name || 'User'}
                        className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                      />
                      <div className="text-white font-medium text-sm truncate">
                        {user.display_name || 'Anonymous'}
                      </div>
                      <div className="text-gray-400 text-xs">{user.clip_count} clips</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : trendingContent ? (
          <div className="space-y-12">
            <div className="text-center mb-8">
              <TrendingUp className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">What's Popping</h2>
              <p className="text-gray-400 mt-2">See what the community's vibing to</p>
            </div>

            {/* Toggle between clips and live events */}
            <div className="flex justify-center space-x-4 mb-8">
              <button
                onClick={() => setShowLiveEvents(false)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  !showLiveEvents
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-cyan-500/20'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Video className="w-5 h-5" />
                  <span>Trending Clips</span>
                </div>
              </button>
              <button
                onClick={() => setShowLiveEvents(true)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  showLiveEvents
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-cyan-500/20'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Ticket className="w-5 h-5" />
                  <span>Live Events</span>
                </div>
              </button>
            </div>

            {/* Premium CTA */}
            <div className="max-w-4xl mx-auto">
              <PremiumCTA variant="banner" context="discover" />
            </div>

            {showLiveEvents ? (
              <div>
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
                  <Ticket className="w-6 h-6 text-cyan-400" />
                  <span>Upcoming Shows</span>
                </h3>
                <p className="text-gray-400 text-sm mb-6 max-w-2xl mx-auto text-center">
                  JamBase powers concert listings here; switch to Ticketmaster when your project has a
                  Ticketmaster API key configured.
                </p>
                <div className="flex justify-center gap-2 mb-8 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setLiveEventCatalog('jambase')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      liveEventCatalog === 'jambase'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                        : 'bg-black/40 text-gray-300 border border-amber-500/30 hover:border-amber-400/50'
                    }`}
                  >
                    JamBase
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveEventCatalog('ticketmaster')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      liveEventCatalog === 'ticketmaster'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                        : 'bg-black/40 text-gray-300 border border-cyan-500/30 hover:border-cyan-400/50'
                    }`}
                  >
                    Ticketmaster
                  </button>
                </div>
                {liveEventCatalog === 'jambase' ? (
                  <JamBaseEventGrid maxEvents={20} />
                ) : (
                  <TicketmasterEventGrid maxEvents={20} />
                )}
              </div>
            ) : (
              <>
                {/* Trending Clips */}
                {trendingContent.clips.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-6">🔥 Trending Clips</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {trendingContent.clips.map((clip, index) => (
                        <div
                          key={clipListItemKey(clip, index)}
                          onClick={() => setSelectedClip(clip)}
                          className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl overflow-hidden hover:border-orange-400/50 transition-all cursor-pointer group"
                        >
                          <div className="relative aspect-video">
                            <img
                              src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                              alt="Concert moment"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute top-3 right-3 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-xs text-white font-bold">
                              🔥 Trending
                            </div>
                          </div>
                          <div className="p-4">
                            {clip.artist_name && (
                              <div className="font-bold text-purple-400 mb-1">{clip.artist_name}</div>
                            )}
                            {clip.content_description && (
                              <p className="text-gray-300 text-sm line-clamp-2">{clip.content_description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Artists */}
                {trendingContent.artists.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-6">⭐ Trending Artists</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {trendingContent.artists.map((artist: any) => (
                        <button
                          key={artist.name}
                          onClick={() => navigate(artistPath(artist.name))}
                          className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/50 transition-all text-center group"
                        >
                          <div className="relative">
                            <img
                              src={artist.image_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'}
                              alt={artist.name}
                              className="w-20 h-20 rounded-full mx-auto mb-3 object-cover group-hover:scale-110 transition-transform"
                            />
                          </div>
                          <div className="text-white font-medium text-sm truncate">{artist.name}</div>
                          <div className="text-gray-400 text-xs">{artist.clip_count} clips</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Venues */}
                {trendingContent.venues.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-6">📍 Trending Venues</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {trendingContent.venues.map((venue: any) => (
                        <button
                          key={venue.name}
                          onClick={() => navigate(venuePath(venue.name))}
                          className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-4 hover:border-blue-400/50 transition-all text-left group"
                        >
                          <div className="flex items-start space-x-3">
                            <MapPin className="w-8 h-8 text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium truncate">{venue.name}</div>
                              {venue.location && (
                                <div className="text-gray-400 text-sm truncate">{venue.location}</div>
                              )}
                              <div className="text-gray-500 text-xs mt-1">{venue.clip_count} clips</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      {selectedClip && (
        <ClipModal 
          clip={selectedClip} 
          onClose={() => setSelectedClip(null)} 
        />
      )}
    </div>
  );
}
