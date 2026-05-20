import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Music, MapPin, Calendar, Ticket, Loader2, ExternalLink, UserPlus, UserCheck, Radio, ShoppingBag, Play } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import NearbyShowsCTA from '@/react-app/components/NearbyShowsCTA';
import ArtistYouTubeSection from '@/react-app/components/ArtistYouTubeSection';
import { useArtistFavorite } from '@/react-app/hooks/useArtistFavorite';
import type { ClipWithUser } from '@/shared/types';
import { apiArtistPath, artistPath, venuePath } from '@/shared/app-paths';
import SectionHeading from '@/react-app/components/SectionHeading';
import { HOME_FEED_SECTION_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

interface Artist {
  id: number;
  name: string;
  bio: string | null;
  image_url: string | null;
  social_links: string | null;
  is_verified: number;
  created_at: string;
  updated_at: string;
}

interface TourDate {
  id: number;
  artist_id: number;
  venue_id: number | null;
  date: string;
  city: string | null;
  country: string | null;
  ticket_url: string | null;
  venue_name: string | null;
  venue_location: string | null;
  created_at: string;
  updated_at: string;
}

interface ArtistData {
  artist: Artist | null;
  clips: ClipWithUser[];
  tourDates: TourDate[];
  jambase_attribution?: boolean;
}

function parseArtistSocialLinks(raw: string | null | undefined): Record<string, string> {
  if (raw == null || !String(raw).trim()) return {};
  try {
    const v = JSON.parse(String(raw));
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return v as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

interface LiveShow {
  session_id: number;
  venue_name: string;
  venue_location: string;
  moments_count: number;
  thumbnail_url: string;
}

interface PreviousShow {
  show_id: string;
  artist_name: string;
  show_date: string;
  venue_name: string;
  clip_count: number;
  average_show_rating: number;
  thumbnail_url: string;
}

export default function ArtistPage() {
  const { artistName: artistNameParam } = useParams<{ artistName: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ArtistData | null>(null);
  const routeArtistLabel = artistNameParam
    ? decodeURIComponent(artistNameParam).replace(/-/g, ' ')
    : '';
  const { favorited, favoritedKnown, loading: favoriteLoading, toggleFavorite } = useArtistFavorite(
    data?.artist?.id ?? 0,
    data?.artist?.name ?? routeArtistLabel,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveShow, setLiveShow] = useState<LiveShow | null>(null);
  const [previousShows, setPreviousShows] = useState<PreviousShow[]>([]);
  
  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artistNameParam) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiArtistPath(artistNameParam));
        
        if (!response.ok) {
          throw new Error('Failed to fetch artist data');
        }

        const artistData = await response.json();
        setData(artistData);

        // Fetch live show status
        await fetchLiveShow();
        
        // Fetch previous shows
        await fetchPreviousShows();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to fetch artist data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchArtistData();
  }, [artistNameParam]);

  const fetchLiveShow = async () => {
    if (!artistNameParam) return;

    try {
      const response = await fetch(`${apiArtistPath(artistNameParam)}/live-status`);
      if (response.ok) {
        const data = await response.json();
        if (data.isLive) {
          setLiveShow(data.liveShow);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live show status:', err);
    }
  };

  const fetchPreviousShows = async () => {
    if (!artistNameParam) return;

    try {
      const response = await fetch(`${apiArtistPath(artistNameParam)}/previous-shows?limit=8`);
      if (response.ok) {
        const data = await response.json();
        setPreviousShows(data.shows || []);
      }
    } catch (err) {
      console.error('Failed to fetch previous shows:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'Artist not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data.artist) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-gray-300 mb-4">We couldn&apos;t load this artist profile yet.</p>
            <button
              onClick={() => navigate('/discover')}
              className="px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform"
            >
              Search on Discover
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { artist, clips, tourDates } = data;
  const socialLinks = parseArtistSocialLinks(artist.social_links);

  return (
    <div className="min-h-screen text-white">
      <Header />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-purple-900/30 to-black border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Artist Image */}
            <div className="relative">
              <img
                src={artist.image_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop'}
                alt={artist.name}
                className="w-48 h-48 rounded-full object-cover border-4 border-purple-500/40 shadow-xl shadow-purple-500/25"
              />
              {artist.is_verified === 1 && (
                <div className="absolute bottom-2 right-2 bg-blue-500 rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Artist Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <Music className="w-8 h-8 text-purple-400" />
                <h1 className="fb-hero-title">{artist.name}</h1>
                {artist.is_verified === 1 && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium">
                    Verified
                  </span>
                )}
              </div>

              {artist.bio && (
                <p className="text-gray-300 text-lg mb-6 max-w-3xl leading-relaxed">
                  {artist.bio}
                </p>
              )}

              {/* Social Links */}
              {Object.keys(socialLinks).length > 0 && (
                <div className="flex items-center space-x-4">
                  {socialLinks.instagram && (
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.website && (
                    <a
                      href={socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <SectionHeading
              title="Concert Moments"
              subtitle="Fan-captured moments from live shows"
              icon={Music}
              iconClassName="text-purple-400"
              badge={
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full font-medium">
                  {clips.length} clips
                </span>
              }
            />

            {clips.length > 0 ? (
              <ConcertFeed
                artistName={artist.name}
                hideSectionHeader
                edgeBleed
                edgeBleedScope="page"
              />
            ) : (
              <div className="text-center py-12 glass-panel border border-purple-500/20 rounded-xl">
                <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nothing here yet</p>
                <p className="text-gray-500 mt-2">Drop the first clip from {artist.name}!</p>
              </div>
            )}
          </div>

          <div className="glass-panel border border-purple-500/20 rounded-xl p-6 h-fit">
            <h3 className="fb-panel-title mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Clips</span>
                <span className="text-white font-bold">{clips.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Likes</span>
                <span className="text-white font-bold">
                  {clips.reduce((sum, clip) => sum + clip.likes_count, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Views</span>
                <span className="text-white font-bold">
                  {clips.reduce((sum, clip) => sum + clip.views_count, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Now Section */}
        {liveShow && (
          <div className="mb-8">
            <button
              onClick={() => navigate(venuePath(liveShow.venue_name))}
              className="w-full bg-gradient-to-r from-red-600 via-orange-600 to-pink-600 rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform group"
            >
              <div className="relative aspect-[21/9]">
                <img
                  src={liveShow.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=500&fit=crop'}
                  alt="Live Now"
                  className="w-full h-full object-cover"
                />
                
                {/* Live badge */}
                <div className="absolute top-6 left-6 flex items-center space-x-2 px-4 py-2 bg-red-600 rounded-full animate-pulse">
                  <Radio className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-lg">LIVE NOW</span>
                </div>

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-24 h-24 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center shadow-2xl">
                    <Play className="w-12 h-12 text-white fill-white ml-1" />
                  </div>
                </div>

                {/* Content */}
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-4xl font-bold text-white mb-2">{artist.name} - Live at {liveShow.venue_name}</h2>
                  <div className="flex items-center space-x-4 text-white/90 text-lg">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5" />
                      <span>{liveShow.venue_location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Music className="w-5 h-5" />
                      <span>{liveShow.moments_count} moments posted</span>
                    </div>
                  </div>
                  <div className="mt-4 inline-flex items-center space-x-2 px-6 py-3 bg-white rounded-xl text-purple-600 font-bold text-lg group-hover:scale-105 transition-transform">
                    <span>Join Show Now</span>
                    <ExternalLink className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Nearby Shows CTA - Show if artist is performing near user */}
        <div className="mb-8">
          <NearbyShowsCTA artistName={artist.name} variant="banner" maxShows={1} />
        </div>

        {/* Previous Shows Section */}
        {previousShows.length > 0 && (
          <div className="mb-8">
            <SectionHeading
              title="Previous Shows on Tour"
              subtitle="Past shows with clips on Feedback"
              icon={Calendar}
              iconClassName="text-purple-400"
              size="page"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {previousShows.map((show) => (
                <button
                  key={show.show_id}
                  onClick={() => navigate(`${artistPath(show.artist_name)}/shows/${show.show_id}/clips`)}
                  className="glass-panel border border-purple-500/20 rounded-xl overflow-hidden hover:border-purple-400/50 transition-all group"
                >
                  <div className="relative aspect-video">
                    <img
                      src={show.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                      alt={`${show.venue_name} - ${formatDate(show.show_date)}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {/* Play overlay — hidden on fine-pointer desktop */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity [@media(hover:hover)_and_(pointer:fine)]:hidden">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Clip count */}
                    <div className="absolute bottom-2 left-2 flex items-center space-x-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                      <Music className="w-3 h-3 text-white" />
                      <span className="text-white text-xs font-medium">{show.clip_count}</span>
                    </div>
                  </div>

                  <div className="p-3">
                    <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{show.venue_name}</h4>
                    <p className="text-gray-400 text-xs">{formatDate(show.show_date)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <section className={`${HOME_FEED_SECTION_CLASS} w-full`}>
          <SectionHeading
            title="Upcoming Shows"
            subtitle="Live dates from JamBase"
            icon={Calendar}
            iconClassName="text-purple-400"
            size="page"
          />
          <JamBaseEventGrid
            artistName={artist.name}
            maxEvents={12}
            layout="carousel"
            carouselAriaLabel={`Upcoming shows for ${artist.name}`}
            carouselClassName={PAGE_CAROUSEL_BLEED}
          />
        </section>

        <section className={`${HOME_FEED_SECTION_CLASS} w-full`}>
          <ArtistYouTubeSection artistName={artist.name} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel border border-purple-500/20 rounded-xl p-6">
              <h3 className="fb-panel-title mb-4">Quick Links</h3>
              <div className="space-y-3">
                {socialLinks.website && (
                  <a
                    href={socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 px-4 py-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <ExternalLink className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="text-white font-medium">Official Website</span>
                  </a>
                )}
                {socialLinks.spotify && (
                  <a
                    href={socialLinks.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 px-4 py-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <Music className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
                    <span className="text-white font-medium">Listen on Spotify</span>
                  </a>
                )}
                {tourDates.length > 0 && tourDates[0].ticket_url && (
                  <a
                    href={tourDates[0].ticket_url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg hover:scale-105 transition-transform group"
                  >
                    <Ticket className="w-5 h-5 text-white" />
                    <span className="text-white font-medium">Get Tickets</span>
                  </a>
                )}
                {socialLinks.merch && (
                  <a
                    href={socialLinks.merch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 px-4 py-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <ShoppingBag className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" />
                    <span className="text-white font-medium">Shop Merch</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => void toggleFavorite()}
              disabled={!favoritedKnown || favoriteLoading}
              className={`w-full px-6 py-4 rounded-xl font-semibold hover:scale-105 transition-transform flex items-center justify-center space-x-2 disabled:opacity-60 disabled:hover:scale-100 ${
                favorited
                  ? 'bg-white/10 border border-purple-500/50 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
              }`}
            >
              {favoriteLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{favorited ? 'Updating…' : 'Saving…'}</span>
                </>
              ) : favorited ? (
                <>
                  <UserCheck className="w-5 h-5" />
                  <span>Unfollow Artist</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Follow Artist</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
