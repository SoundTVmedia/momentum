import { useState, useEffect } from 'react';
import { Calendar, MapPin, Ticket, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import { useTicketmaster } from '@/react-app/hooks/useTicketmaster';
import type { ExtendedMochaUser } from '@/shared/types';

interface TicketmasterEventGridProps {
  city?: string;
  genre?: string;
  maxEvents?: number;
}

export default function TicketmasterEventGrid({ 
  city, 
  genre, 
  maxEvents = 12 
}: TicketmasterEventGridProps) {
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const { events, loading, searchEvents, trackTicketClick } = useTicketmaster();
  const [hasSearched, setHasSearched] = useState(false);

  const isAmbassador = extendedUser?.profile?.role === 'ambassador';

  useEffect(() => {
    const fetchEvents = async () => {
      await searchEvents({ city, genre });
      setHasSearched(true);
    };
    
    fetchEvents();
  }, [city, genre, searchEvents]);

  const handleTicketClick = async (event: any) => {
    if (event.url) {
      await trackTicketClick(
        event.id,
        event.name,
        event.url,
        event.priceRanges?.[0]?.min,
        isAmbassador && user ? user.id : undefined
      );
      window.open(event.url, '_blank');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatPrice = (priceRanges?: any[]) => {
    if (!priceRanges || priceRanges.length === 0) return 'See Tickets';
    const min = priceRanges[0].min;
    return `From $${min.toFixed(0)}`;
  };

  const getEventImage = (event: any) => {
    if (!event.images || event.images.length === 0) {
      return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop';
    }
    
    // Find the best image (prefer 16:9 ratio)
    const bestImage = event.images.find((img: any) => img.ratio === '16_9') || event.images[0];
    return bestImage.url;
  };

  const getVenueName = (event: any) => {
    return event._embedded?.venues?.[0]?.name || 'Venue TBA';
  };

  const getLocation = (event: any) => {
    const venue = event._embedded?.venues?.[0];
    if (!venue) return '';
    
    const city = venue.city?.name;
    const state = venue.state?.stateCode;
    
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    return '';
  };

  const getGenre = (event: any) => {
    const classification = event.classifications?.[0] || event._embedded?.attractions?.[0]?.classifications?.[0];
    return classification?.genre?.name || classification?.segment?.name || 'Concert';
  };

  if (loading && !hasSearched) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!loading && hasSearched && events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No events found. Try adjusting your filters.</p>
      </div>
    );
  }

  const displayEvents = events.slice(0, maxEvents);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {displayEvents.map((event) => (
        <div
          key={event.id}
          className="group bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/50 hover:scale-105 transition-all duration-300"
        >
          <div className="relative">
            <img
              src={getEventImage(event)}
              alt={event.name}
              className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Genre Tag */}
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-black/70 backdrop-blur-lg rounded-full text-xs text-white font-medium">
                {getGenre(event)}
              </span>
            </div>

            {/* Remove any sold out indicators - intentionally left empty */}
          </div>

          <div className="p-6">
            <h3 className="font-bold text-lg text-white mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2">
              {event.name}
            </h3>

            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 text-gray-300 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{getVenueName(event)}</span>
              </div>
              
              {getLocation(event) && (
                <div className="text-xs text-gray-400 pl-6 truncate">{getLocation(event)}</div>
              )}

              <div className="flex items-center space-x-2 text-gray-300 text-sm">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{formatDate(event.dates?.start?.localDate)}</span>
              </div>

              {event.dates?.start?.localTime && (
                <div className="flex items-center space-x-2 text-gray-300 text-sm">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>{event.dates.start.localTime}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold">{formatPrice(event.priceRanges)}</span>
              <button
                onClick={() => handleTicketClick(event)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:scale-105 transition-transform shadow-lg shadow-cyan-500/25"
              >
                <Ticket className="w-4 h-4" />
                <span>Tickets</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {isAmbassador && (
              <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-orange-400 text-xs text-center">
                  💰 Earn commission on ticket sales
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
