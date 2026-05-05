import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { MapPin, Calendar, Music, Loader2, UserPlus, UserCheck, Users, ChevronDown, Heart, MessageCircle } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import ShowArchive from '@/react-app/components/ShowArchive';
import { useFollow } from '@/react-app/hooks/useFollow';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';

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
}

interface RecentShow {
  show_id: string;
  artist_name: string;
  show_date: string;
  clips: ClipWithUser[];
}

const CLIPS_PER_PAGE = 12; // 3-4 rows of clips (3 per row)

export default function VenuePage() {
  const { venueName } = useParams<{ venueName: string }>();
  const navigate = useNavigate();
  const { toggleFollow, isFollowing, isLoading: followLoading } = useFollow();
  
  const [data, setData] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [displayedClips, setDisplayedClips] = useState<ClipWithUser[]>([]);
  const [clipsPage, setClipsPage] = useState(1);
  const [recentShow, setRecentShow] = useState<RecentShow | null>(null);

  useEffect(() => {
    const fetchVenueData = async () => {
      if (!venueName) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/venues/${encodeURIComponent(venueName)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch venue data');
        }

        const venueData = await response.json();
        setData(venueData);
        
        // Set initial displayed clips
        const allClips = venueData.clips || [];
        setDisplayedClips(allClips.slice(0, CLIPS_PER_PAGE));
        
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
        `/api/venues/${encodeURIComponent(venueName)}/archive?sort_by=date_played&limit=1`
      );
      
      if (response.ok) {
        const archiveData = await response.json();
        const shows = archiveData.shows || [];
        
        if (shows.length > 0) {
          const mostRecentShow = shows[0];
          
          // Fetch clips for this show
          const clipsResponse = await fetch(
            `/api/artists/${encodeURIComponent(mostRecentShow.artist_name)}/shows/${mostRecentShow.show_id}/clips?limit=6`
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

  const loadMoreClips = () => {
    if (!data) return;
    
    const nextPage = clipsPage + 1;
    const startIndex = clipsPage * CLIPS_PER_PAGE;
    const endIndex = startIndex + CLIPS_PER_PAGE;
    const newClips = data.clips.slice(startIndex, endIndex);
    
    setDisplayedClips(prev => [...prev, ...newClips]);
    setClipsPage(nextPage);
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'Venue not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { venue, clips, upcomingEvents } = data;
  const hasMoreClips = displayedClips.length < clips.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-blue-900/30 to-black border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Venue Image */}
            <div className="relative">
              <img
                src={venue.image_url || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&h=300&fit=crop'}
                alt={venue.name}
                className="w-48 h-48 rounded-xl object-cover border-4 border-blue-500/40 shadow-xl shadow-blue-500/25"
              />
            </div>

            {/* Venue Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <MapPin className="w-8 h-8 text-blue-400" />
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
          <div className="lg:col-span-2 space-y-8">
            {/* Live Clips/Moments Section */}
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <Music className="w-6 h-6 text-blue-400" />
                <h2 className="text-3xl font-bold text-white">Live Moments</h2>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full font-medium">
                  {clips.length} clips
                </span>
              </div>
              
              {displayedClips.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedClips.map((clip, index) => (
                      <div
                        key={clipListItemKey(clip, index)}
                        className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-400/50 transition-all group cursor-pointer"
                        onClick={() => setSelectedClip(clip)}
                      >
                        <div className="relative aspect-video">
                          <img
                            src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                            alt="Concert moment"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          
                          {/* Play overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl">
                              <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[12px] border-y-transparent ml-1"></div>
                            </div>
                          </div>

                          {/* User info overlay */}
                          <div className="absolute top-2 left-2 flex items-center space-x-2">
                            <img 
                              src={clip.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                              alt={clip.user_display_name || 'User'}
                              className="w-8 h-8 rounded-full border-2 border-white/30"
                            />
                          </div>

                          {/* Time overlay */}
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                            <span className="text-white text-xs">{formatTimestamp(clip.created_at)}</span>
                          </div>
                        </div>

                        <div className="p-3">
                          {clip.artist_name && (
                            <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{clip.artist_name}</h4>
                          )}
                          {clip.content_description && (
                            <p className="text-gray-400 text-xs line-clamp-2 mb-2">{clip.content_description}</p>
                          )}
                          
                          {/* Quick actions */}
                          <div className="flex items-center space-x-3 text-xs">
                            <div className="flex items-center space-x-1 text-gray-400">
                              <Heart className="w-3 h-3" />
                              <span>{clip.likes_count}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-gray-400">
                              <MessageCircle className="w-3 h-3" />
                              <span>{clip.comments_count}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Load More Button */}
                  {hasMoreClips && (
                    <div className="flex justify-center mt-8">
                      <button
                        onClick={loadMoreClips}
                        className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl text-white font-semibold hover:scale-105 transition-transform flex items-center space-x-2"
                      >
                        <span>Load More</span>
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl">
                  <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Nothing here yet</p>
                  <p className="text-gray-500 mt-2">Drop the first clip from {venue.name}!</p>
                </div>
              )}
            </div>

            {/* Previous Shows at [Venue Name] Section */}
            {recentShow && recentShow.clips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
                    <Calendar className="w-6 h-6 text-purple-400" />
                    <span>Previous Shows at {venue.name}</span>
                  </h3>
                </div>

                <div className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-white">{recentShow.artist_name}</h4>
                      <p className="text-gray-400 text-sm">{formatDate(recentShow.show_date)}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/artists/${encodeURIComponent(recentShow.artist_name)}/shows/${recentShow.show_id}/clips`)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg text-white text-sm font-medium hover:scale-105 transition-transform"
                    >
                      View Full Show
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {recentShow.clips.map((clip, index) => (
                      <button
                        key={clipListItemKey(clip, index)}
                        onClick={() => navigate(`/artists/${encodeURIComponent(recentShow.artist_name)}/shows/${recentShow.show_id}/clips`)}
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
            <ShowArchive venueName={venue.name} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-6">
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

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <div className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">Upcoming Events</h3>
                </div>
                <div className="space-y-4">
                  {upcomingEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center space-x-3 mb-2">
                        {event.artist_image && (
                          <img
                            src={event.artist_image}
                            alt={event.artist_name || 'Artist'}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="text-white font-bold">{event.artist_name || 'Artist'}</div>
                          <div className="text-sm text-gray-400">{formatDate(event.date)}</div>
                        </div>
                      </div>
                      {event.ticket_url && (
                        <a
                          href={event.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center justify-center space-x-2 w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg text-white text-sm font-medium hover:scale-105 transition-transform"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>Get Tickets</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {upcomingEvents.length > 5 && (
                  <button className="w-full mt-4 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors">
                    View All Events
                  </button>
                )}
              </div>
            )}

            {/* Follow Button */}
            <button 
              onClick={() => venue && toggleFollow(`venue-${venue.id}`)}
              disabled={followLoading(`venue-${venue?.id || 0}`)}
              className={`w-full px-6 py-4 rounded-xl font-semibold hover:scale-105 transition-transform flex items-center justify-center space-x-2 ${
                isFollowing(`venue-${venue?.id || 0}`)
                  ? 'bg-white/10 border border-blue-500/50 text-white'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
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

      {/* Clip Modal */}
      {selectedClip && (
        <ClipModal 
          clip={selectedClip} 
          onClose={() => setSelectedClip(null)} 
        />
      )}
    </div>
  );
}
