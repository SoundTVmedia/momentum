import { Calendar, Star, Video, Play, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

interface Show {
  show_id: string;
  artist_name: string;
  show_date: string;
  clip_count: number;
  average_show_rating: number;
  thumbnail_url: string;
}

interface ShowArchiveProps {
  venueName: string;
}

const SHOWS_PER_PAGE = 8; // 2 rows of 4 shows

export default function ShowArchive({ venueName }: ShowArchiveProps) {
  const navigate = useNavigate();
  const [shows, setShows] = useState<Show[]>([]);
  const [displayedShows, setDisplayedShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date_played' | 'average_rating'>('date_played');
  const [showsPage, setShowsPage] = useState(1);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    fetchShows();
  }, [venueName, sortBy]);

  const fetchShows = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/venues/${encodeURIComponent(venueName)}/archive?sort_by=${sortBy}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        const allShows = data.shows || [];
        setShows(allShows);
        
        // Initially show first page
        setDisplayedShows(allShows.slice(0, SHOWS_PER_PAGE));
        setShowsPage(1);
      }
    } catch (error) {
      console.error('Failed to fetch shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreShows = () => {
    const nextPage = showsPage + 1;
    const startIndex = showsPage * SHOWS_PER_PAGE;
    const endIndex = startIndex + SHOWS_PER_PAGE;
    const newShows = shows.slice(startIndex, endIndex);
    
    setDisplayedShows(prev => [...prev, ...newShows]);
    setShowsPage(nextPage);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleShowClick = (show: Show) => {
    navigate(
      `/artists/${encodeURIComponent(show.artist_name)}/shows/${show.show_id}/clips`
    );
  };

  const hasMoreShows = displayedShows.length < shows.length;

  if (!showArchive) {
    // Show collapsed state with button to view archive
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <button
            onClick={() => setShowArchive(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-white font-semibold hover:scale-105 transition-transform flex items-center space-x-2"
          >
            <Calendar className="w-5 h-5" />
            <span>View All Previous Shows</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Calendar className="w-6 h-6 text-blue-400" />
          <span>All Past Shows</span>
        </h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date_played' | 'average_rating')}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400"
        >
          <option value="date_played">Most Recent</option>
          <option value="average_rating">Highest Rated</option>
        </select>
      </div>

      {displayedShows.length === 0 ? (
        <div className="text-center py-12 bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No archived shows yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayedShows.map((show) => (
              <button
                key={show.show_id}
                onClick={() => handleShowClick(show)}
                className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-400/50 transition-all group text-left"
              >
                <div className="relative aspect-video">
                  <img
                    src={
                      show.thumbnail_url ||
                      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
                    }
                    alt={`${show.artist_name} at ${venueName}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Stats overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-white text-sm">
                      <Video className="w-4 h-4" />
                      <span>{show.clip_count} clips</span>
                    </div>
                    {show.average_show_rating > 0 && (
                      <div className="flex items-center space-x-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-white text-sm font-medium">
                          {show.average_show_rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="text-white font-bold text-lg mb-1 line-clamp-1">{show.artist_name}</h4>
                  <div className="flex items-center space-x-2 text-gray-400 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(show.show_date)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Load More Button */}
          {hasMoreShows && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMoreShows}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl text-white font-semibold hover:scale-105 transition-transform flex items-center space-x-2"
              >
                <span>Load More Shows</span>
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Collapse Button */}
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowArchive(false)}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Hide Archive
            </button>
          </div>
        </>
      )}
    </div>
  );
}
