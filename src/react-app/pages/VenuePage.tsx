import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { MapPin, Calendar, Music, Loader2, UserPlus, UserCheck, Users } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import ShowArchive from '@/react-app/components/ShowArchive';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { useFollow } from '@/react-app/hooks/useFollow';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { HOME_FEED_SECTION_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { venueUpcomingCarouselProps } from '@/react-app/lib/venue-upcoming-events';
import { apiArtistPath, apiVenuePath, artistPath } from '@/shared/app-paths';

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

interface RecentShow {
  show_id: string;
  artist_name: string;
  show_date: string;
  clips: ClipWithUser[];
}

export default function VenuePage() {
  const { venueName } = useParams<{ venueName: string }>();
  const navigate = useNavigate();
  const { toggleFollow, isFollowing, isLoading: followLoading } = useFollow();
  
  const [data, setData] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentShow, setRecentShow] = useState<RecentShow | null>(null);

  useEffect(() => {
    const fetchVenueData = async () => {
      if (!venueName) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiVenuePath(venueName ?? ''));
        
        if (!response.ok) {
          throw new Error('Failed to fetch venue data');
        }

        const venueData = await response.json();
        setData(venueData);

        // Fetch most recent show
        await fetchMostRecentShow();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to fetch venue data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVenueData();
  }, [venueName]);

  const fetchMostRecentShow = async () => {
    if (!venueName) return;
    
    try {
      const response = await fetch(
        `${apiVenuePath(venueName ?? '')}/archive?sort_by=date_played&limit=1`
      );
      
      if (response.ok) {
        const archiveData = await response.json();
        const shows = archiveData.shows || [];
        
        if (shows.length > 0) {
          const mostRecentShow = shows[0];
          
          // Fetch clips for this show
          const clipsResponse = await fetch(
            `${apiArtistPath(mostRecentShow.artist_name)}/shows/${mostRecentShow.show_id}/clips?limit=6`
          );
          
          if (clipsResponse.ok) {
            const clipsData = await clipsResponse.json();
            setRecentShow({
              show_id: mostRecentShow.show_id,
              artist_name: mostRecentShow.artist_name,
              show_date: mostRecentShow.show_date,
              clips: clipsData.clips || []
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch recent show:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
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
            <p className="text-red-400 mb-4">{error || 'Venue not found'}</p>
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

  const { venue, clips, upcomingEvents } = data;

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

              {venue.capacity && (
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <p className="text-gray-400">
                    Capacity: <span className="text-white font-medium">{venue.capacity.toLocaleString()}</span>
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

            {/* Previous Shows at [Venue Name] Section */}
            {recentShow && recentShow.clips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
                    <Calendar className="w-6 h-6 text-momentum-rose" />
                    <span>Previous Shows at {venue.name}</span>
                  </h3>
                </div>

                <div className="glass-panel border border-momentum-rose/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-white">{recentShow.artist_name}</h4>
                      <p className="text-gray-400 text-sm">{formatDate(recentShow.show_date)}</p>
                    </div>
                    <button
                      onClick={() => navigate(`${artistPath(recentShow.artist_name)}/shows/${recentShow.show_id}/clips`)}
                      className="px-4 py-2 bg-gradient-to-r from-momentum-flare to-momentum-rose rounded-lg text-white text-sm font-medium hover:scale-105 transition-transform"
                    >
                      View Full Show
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {recentShow.clips.map((clip, index) => (
                      <button
                        key={clipListItemKey(clip, index)}
                        onClick={() => navigate(`${artistPath(recentShow.artist_name)}/shows/${recentShow.show_id}/clips`)}
                        className="relative aspect-video rounded-lg overflow-hidden group"
                      >
                        <img
                          src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=150&fit=crop'}
                          alt="Show moment"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[8px] border-y-transparent ml-0.5"></div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Full Show Archive */}
            <div >
              <ShowArchive venueName={venue.name} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="glass-panel border border-momentum-flare/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Venue Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Clips</span>
                  <span className="text-white font-bold">{clips.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Likes</span>
                  <span className="text-white font-bold">
                    {clips.reduce((sum, clip) => sum + clip.likes_count, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Views</span>
                  <span className="text-white font-bold">
                    {clips.reduce((sum, clip) => sum + clip.views_count, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Follow Button */}
            <button 
              onClick={() => venue && toggleFollow(`venue-${venue.id}`)}
              disabled={followLoading(`venue-${venue?.id || 0}`)}
              className={`w-full px-6 py-4 rounded-xl font-semibold hover:scale-105 transition-transform flex items-center justify-center space-x-2 ${
                isFollowing(`venue-${venue?.id || 0}`)
                  ? 'bg-white/10 border border-momentum-flare/50 text-white'
                  : 'bg-gradient-to-r from-momentum-ember to-momentum-flare text-white'
              }`}
            >
              {isFollowing(`venue-${venue?.id || 0}`) ? (
                <>
                  <UserCheck className="w-5 h-5" />
                  <span>Following</span>
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
