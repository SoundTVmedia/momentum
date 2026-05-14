import { useEffect, useState } from 'react';
import { Calendar, MapPin, Music, ExternalLink, Loader2, Heart } from 'lucide-react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';

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
};

export default function PersonalizedConcerts() {
  const [payload, setPayload] = useState<ConcertsApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConcerts = async () => {
      try {
        const response = await fetch('/api/personalization/concerts?limit=12', {
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
        console.error('Failed to fetch personalized concerts:', error);
        setPayload({ personalized: false, concerts: [], events: [] });
      } finally {
        setLoading(false);
      }
    };

    void fetchConcerts();
  }, []);

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-lg border border-momentum-teal/20 rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading your recommendations...</span>
        </div>
      </div>
    );
  }

  const jbEvents = payload?.events ?? [];
  const d1Concerts = payload?.concerts ?? [];
  const hasShows = jbEvents.length > 0 || d1Concerts.length > 0;

  if (!payload?.personalized || !hasShows) {
    return (
      <div className="bg-gradient-to-br from-momentum-teal/18 to-momentum-mint/10 backdrop-blur-lg border border-momentum-teal/25 rounded-xl p-8">
        <div className="text-center">
          <Heart className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            No Upcoming Concerts from Your Favorites
          </h3>
          <p className="text-gray-300 mb-4">
            {payload?.message === 'No favorite artists set'
              ? 'Add favorite artists in your profile to see JamBase tour dates here.'
              : typeof payload?.message === 'string' && payload.message.length > 0
                ? payload.message
                : "We'll show upcoming JamBase dates for artists you follow — or add favorites in your dashboard."}
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
            {payload?.source === 'jambase'
              ? 'Upcoming shows from JamBase for your favorite artists'
              : 'Upcoming concerts from artists you love'}
          </p>
        </div>
      </div>

      {jbEvents.length > 0 ? (
        <JamBaseEventGrid preloadedEvents={jbEvents} maxEvents={12} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {d1Concerts.map((concert) => (
            <div
              key={concert.id}
              className="group bg-black/40 backdrop-blur-lg border border-momentum-teal/20 rounded-xl overflow-hidden hover:border-momentum-mint/50 transition-all hover:scale-105"
            >
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

              <div className="p-4 space-y-3">
                <h3 className="text-lg font-bold text-white truncate">{concert.artist_name}</h3>

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

                {concert.ticket_url && (
                  <a
                    href={concert.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 w-full px-4 py-2 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-105 transition-transform"
                  >
                    <span>Get Tickets</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {jbEvents.length >= 12 && (
        <div className="text-center pt-4">
          <a href="/discover" className="text-cyan-400 hover:text-cyan-300 font-medium">
            See more on Discover →
          </a>
        </div>
      )}
    </div>
  );
}
