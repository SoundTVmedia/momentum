import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAutoRetryPageLoad } from '@/react-app/hooks/useAutoRetryPageLoad';
import { fetchJsonWithRetry } from '@/react-app/lib/fetch-json-with-retry';
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
  const routeArtistLabel = artistNameParam
    ? decodeURIComponent(artistNameParam).replace(/-/g, ' ')
    : '';

  const loadArtistPage = useCallback(
    async (signal: AbortSignal): Promise<ArtistData> => {
      if (!artistNameParam) throw new Error('Missing artist');
      return fetchJsonWithRetry<ArtistData>(
        apiArtistPath(artistNameParam),
        { signal },
        {
          isValid: (payload) =>
            Boolean(
              payload?.artist &&
                typeof payload.artist === 'object' &&
                typeof (payload.artist as Artist).name === 'string' &&
                (payload.artist as Artist).name.trim().length > 0,
            ),
        },
      );
    },
    [artistNameParam],
  );

  const { data, loading, slowLoad } = useAutoRetryPageLoad({
    enabled: Boolean(artistNameParam),
    load: loadArtistPage,
    validate: (payload) => Boolean(payload.artist?.name?.trim()),
  });

  const { favorited, favoritedKnown, loading: favoriteLoading, toggleFavorite } = useArtistFavorite(
    data?.artist?.id ?? 0,
    data?.artist?.name ?? routeArtistLabel,
  );
  const [liveShow, setLiveShow] = useState<LiveShow | null>(null);
  const [previousShows, setPreviousShows] = useState<PreviousShow[]>([]);

  useEffect(() => {
    if (!artistNameParam || !data?.artist?.name) {
      setLiveShow(null);
      setPreviousShows([]);
      return;
    }

    const ac = new AbortController();

    void (async () => {
      try {
        const liveRes = await fetch(`${apiArtistPath(artistNameParam)}/live-status`, {
          signal: ac.signal,
        });
        if (liveRes.ok) {
          const liveData = (await liveRes.json()) as { isLive?: boolean; liveShow?: LiveShow };
          setLiveShow(liveData.isLive ? liveData.liveShow ?? null : null);
        } else {
          setLiveShow(null);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Failed to fetch live show status:', err);
        }
      }

      try {
        const prevRes = await fetch(
          `${apiArtistPath(artistNameParam)}/previous-shows?limit=8`,
          { signal: ac.signal },
        );
        if (prevRes.ok) {
          const prevData = (await prevRes.json()) as { shows?: PreviousShow[] };
          setPreviousShows(prevData.shows ?? []);
        } else {
          setPreviousShows([]);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Failed to fetch previous shows:', err);
        }
      }
    })();

    return () => ac.abort();
  }, [artistNameParam, data?.artist?.name]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading || !data?.artist) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
          {slowLoad ? (
            <p className="mt-4 text-sm text-gray-400">Still loading this artist…</p>
          ) : null}
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
      <div className="relative bg-gradient-to-b from-momentum-rose/30 to-black border-b border-momentum-rose/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Artist Image */}
            <div className="relative">
              <img
                src={artist.image_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop'}
                alt={artist.name}
                className="w-48 h-48 rounded-full object-cover border-4 border-momentum-rose/40 shadow-xl shadow-momentum-rose/25"
              />
              {artist.is_verified === 1 && (
                <div className="absolute bottom-2 right-2 bg-momentum-flare rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Artist Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <h1 className="fb-hero-title">{artist.name}</h1>
                {artist.is_verified === 1 && (
                  <span className="px-3 py-1 bg-momentum-flare/20 text-momentum-flare text-sm rounded-full font-medium">
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
                      className="text-gray-400 hover:text-momentum-rose transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-momentum-rose transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.website && (
                    <a
                      href={socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-momentum-rose transition-colors"
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
        <div className="mb-8">
          <SectionHeading
            title="Latest Concert Moments"
            subtitle="Fan-captured moments from live shows"
            badge={
              <span className="px-3 py-1 bg-momentum-rose/20 text-momentum-rose text-sm rounded-full font-medium">
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
            <div className="text-center py-12 glass-panel border border-momentum-rose/20 rounded-xl">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Nothing here yet</p>
              <p className="text-gray-500 mt-2">Drop the first clip from {artist.name}!</p>
            </div>
          )}
        </div>

        {/* Live Now Section */}
        {liveShow && (
          <div className="mb-8">
            <button
              onClick={() => navigate(venuePath(liveShow.venue_name))}
              className="w-full bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-rose rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform group"
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
                  <div className="mt-4 inline-flex items-center space-x-2 px-6 py-3 bg-white rounded-xl text-momentum-rose font-bold text-lg group-hover:scale-105 transition-transform">
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
              iconClassName="text-momentum-rose"
              size="page"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {previousShows.map((show) => (
                <button
                  key={show.show_id}
                  onClick={() => navigate(`${artistPath(show.artist_name)}/shows/${show.show_id}/clips`)}
                  className="glass-panel border border-momentum-rose/20 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-all group"
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
            <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
              <h3 className="fb-panel-title mb-4">Quick Links</h3>
              <div className="space-y-3">
                {socialLinks.website && (
                  <a
                    href={socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 px-4 py-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <ExternalLink className="w-5 h-5 text-momentum-rose group-hover:scale-110 transition-transform" />
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
                    className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-momentum-flare to-momentum-rose rounded-lg hover:scale-105 transition-transform group"
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
                    <ShoppingBag className="w-5 h-5 text-momentum-ember group-hover:scale-110 transition-transform" />
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
                  ? 'bg-white/10 border border-momentum-rose/50 text-white'
                  : 'bg-gradient-to-r from-momentum-flare to-momentum-rose text-white'
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
                  <span>Remove from Favorites</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Add Artist to Favorites</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
