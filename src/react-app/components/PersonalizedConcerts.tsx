import { useEffect, useState } from 'react';
import { Calendar, MapPin, Music, ExternalLink, Loader2, Heart } from 'lucide-react';

interface Concert {
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

export default function PersonalizedConcerts() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    const fetchConcerts = async () => {
      try {
        const response = await fetch('/api/personalization/concerts?limit=6');
        const data = await response.json();
        
        setConcerts(data.concerts || []);
        setPersonalized(data.personalized || false);
      } catch (error) {
        console.error('Failed to fetch personalized concerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConcerts();
  }, []);

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading your recommendations...</span>
        </div>
      </div>
    );
  }

  if (!personalized || concerts.length === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border border-purple-500/20 rounded-xl p-8">
        <div className="text-center">
          <Heart className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            No Upcoming Concerts from Your Favorites
          </h3>
          <p className="text-gray-300 mb-4">
            We'll notify you when your favorite artists announce new shows!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Music className="w-6 h-6 text-cyan-400" />
            <span>Your Artists Are Coming</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Upcoming concerts from artists you love
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {concerts.map((concert) => (
          <div
            key={concert.id}
            className="group bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/50 transition-all hover:scale-105"
          >
            {/* Artist Image */}
            {concert.artist_image && (
              <div className="relative h-40 overflow-hidden">
                <img
                  src={concert.artist_image}
                  alt={concert.artist_name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              </div>
            )}

            {/* Concert Details */}
            <div className="p-4 space-y-3">
              <h3 className="text-lg font-bold text-white truncate">
                {concert.artist_name}
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-start space-x-2 text-gray-300">
                  <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{concert.venue_name}</div>
                    <div className="text-xs text-gray-400">{concert.venue_location}</div>
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

              {/* Ticket Link */}
              {concert.ticket_url && (
                <a
                  href={concert.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
                >
                  <span>Get Tickets</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {concerts.length >= 6 && (
        <div className="text-center pt-4">
          <a
            href="/discover"
            className="text-cyan-400 hover:text-cyan-300 font-medium"
          >
            See all upcoming concerts →
          </a>
        </div>
      )}
    </div>
  );
}
