import { useState, useEffect } from 'react';
import { Calendar, MapPin, Navigation, Ticket, ExternalLink, X } from 'lucide-react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import { useTicketmaster } from '@/react-app/hooks/useTicketmaster';

interface NearbyShowsCTAProps {
  artistName?: string; // Optional: filter to specific artist
  maxShows?: number;
  variant?: 'banner' | 'card'; // Display style
}

export default function NearbyShowsCTA({ 
  artistName, 
  maxShows = 3,
  variant = 'banner'
}: NearbyShowsCTAProps) {
  const { location, requestLocation, loading: geoLoading } = useGeolocation();
  const { events, searchEvents, trackTicketClick, loading: eventsLoading } = useTicketmaster();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);

  useEffect(() => {
    const loadNearbyShows = async () => {
      if (location?.city && location?.state) {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3); // Next 3 months
        
        await searchEvents({
          q: artistName,
          city: location.city,
          state: location.state,
          endDate: endDate.toISOString().split('T')[0],
        });
      }
    };

    loadNearbyShows();
  }, [location, artistName]);

  const handleEnableLocation = async () => {
    setHasRequestedLocation(true);
    await requestLocation();
  };

  const handleTicketClick = async (event: any) => {
    if (event.url) {
      await trackTicketClick(
        event.id,
        event.name,
        event.url,
        event.priceRanges?.[0]?.min
      );
      window.open(event.url, '_blank');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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

  // Don't show if dismissed or no events
  if (isDismissed || (!geoLoading && !eventsLoading && events.length === 0)) {
    return null;
  }

  // Location prompt
  if (!location && !hasRequestedLocation) {
    return (
      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-lg border border-cyan-500/40 rounded-xl p-6 relative">
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Navigation className="w-8 h-8 text-cyan-400" />
            <div>
              <h3 className="text-white font-bold text-lg">Find Shows Near You</h3>
              <p className="text-gray-300 text-sm">
                Enable location to see {artistName ? `${artistName} concerts` : 'concerts'} happening nearby
              </p>
            </div>
          </div>
          <button
            onClick={handleEnableLocation}
            disabled={geoLoading}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-bold hover:scale-105 transition-transform disabled:opacity-50 whitespace-nowrap"
          >
            {geoLoading ? 'Loading...' : 'Enable Location'}
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (eventsLoading) {
    return (
      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-lg border border-cyan-500/40 rounded-xl p-6">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-300">Finding shows near you...</p>
        </div>
      </div>
    );
  }

  const displayEvents = events.slice(0, maxShows);

  // Banner variant (single show highlight)
  if (variant === 'banner' && displayEvents.length > 0) {
    const event = displayEvents[0];
    
    return (
      <div className="bg-gradient-to-r from-orange-600/30 to-pink-600/30 backdrop-blur-lg border-2 border-orange-500/50 rounded-xl p-6 relative overflow-hidden shadow-lg shadow-orange-500/20">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-pink-500/10 animate-pulse"></div>
        
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            {/* Event Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Ticket className="w-6 h-6 text-orange-400 animate-pulse" />
                <span className="px-3 py-1 bg-orange-500 rounded-full text-white text-xs font-bold">
                  COMING TO YOUR AREA
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">
                {event.name}
              </h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-gray-200">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="font-medium">{getVenueName(event)}</div>
                    <div className="text-sm text-gray-300">{getLocation(event)}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 text-gray-200">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="font-medium">{formatDate(event.dates?.start?.localDate)}</span>
                    {event.dates?.start?.localTime && (
                      <span className="ml-2 text-sm text-gray-300">
                        • {formatTime(event.dates.start.localTime)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {event.priceRanges && event.priceRanges.length > 0 && (
                <p className="text-cyan-400 font-bold text-lg mb-4">
                  From ${event.priceRanges[0].min.toFixed(0)}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col items-end space-y-2">
              <button
                onClick={() => handleTicketClick(event)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg font-bold hover:scale-105 transition-transform shadow-lg shadow-orange-500/50"
              >
                <Ticket className="w-5 h-5" />
                <span>Get Tickets</span>
                <ExternalLink className="w-4 h-4" />
              </button>
              
              {displayEvents.length > 1 && (
                <p className="text-sm text-gray-300">
                  +{displayEvents.length - 1} more show{displayEvents.length > 2 ? 's' : ''} nearby
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card variant (multiple shows grid)
  if (variant === 'card') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Navigation className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-bold text-white">
              {artistName ? `${artistName} Near You` : 'Shows Near You'}
            </h3>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayEvents.map((event) => (
            <div
              key={event.id}
              className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-4 hover:border-cyan-400/50 transition-all"
            >
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-white text-lg line-clamp-2 mb-1">
                    {event.name}
                  </h4>
                  <p className="text-sm text-gray-400">{getVenueName(event)}</p>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>{formatDate(event.dates?.start?.localDate)}</span>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span>{getLocation(event)}</span>
                </div>

                {event.priceRanges && event.priceRanges.length > 0 && (
                  <p className="text-cyan-400 font-bold">
                    From ${event.priceRanges[0].min.toFixed(0)}
                  </p>
                )}

                <button
                  onClick={() => handleTicketClick(event)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:scale-105 transition-transform"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Get Tickets</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
