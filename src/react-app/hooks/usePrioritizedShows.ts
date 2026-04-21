import { useState, useEffect } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { useGeolocation } from './useGeolocation';

export interface PrioritizedShow {
  type: 'live' | 'upcoming_favorite' | 'favorite_artist' | 'trending' | 'nearby_upcoming';
  priority: number;
  
  // Live show data
  session_id?: number;
  is_live?: boolean;
  moments_count?: number;
  
  // Artist data
  artist_name?: string;
  artist_image?: string;
  bio?: string;
  clip_count?: number;
  
  // Venue data
  venue_name?: string;
  venue_location?: string;
  location?: string;
  venue_id?: number;
  
  // Event data
  date?: string;
  start_time?: string;
  ticket_url?: string;
  
  // Metadata
  is_favorite?: boolean;
  distance_miles?: number;
  
  // Clip data (for trending type)
  clip?: any;
}

export function usePrioritizedShows() {
  const { user } = useAuth();
  const { location, requestLocation } = useGeolocation();
  const [shows, setShows] = useState<PrioritizedShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  useEffect(() => {
    fetchPrioritizedShows();
  }, [user, location]);

  const fetchPrioritizedShows = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (user?.id) {
        params.append('user_id', user.id);
      }
      
      if (location) {
        params.append('latitude', location.latitude.toString());
        params.append('longitude', location.longitude.toString());
        params.append('radius_miles', '60');
      }

      const response = await fetch(`/api/discover/prioritized-shows?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch prioritized shows');
      }

      const data = await response.json();
      setShows(data.shows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch prioritized shows:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestUserLocation = async () => {
    if (!locationRequested) {
      setLocationRequested(true);
      await requestLocation();
    }
  };

  return {
    shows,
    loading,
    error,
    hasLocation: !!location,
    requestUserLocation,
    refresh: fetchPrioritizedShows,
  };
}
