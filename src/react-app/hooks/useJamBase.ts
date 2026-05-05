import { useState, useCallback } from 'react';
import type { JamBaseArtist, JamBaseVenue, JamBaseEvent } from '@/shared/types';

/**
 * Hook for JamBase API integration
 * Provides search and auto-tagging functionality
 */
export function useJamBase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for artists
  const searchArtists = useCallback(async (query: string): Promise<JamBaseArtist[]> => {
    if (!query || query.length < 2) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jambase/search/artists?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Failed to search artists');
      }

      const data = await response.json();
      return data.artists || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Artist search error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Search for venues
  const searchVenues = useCallback(async (query: string, location?: string): Promise<JamBaseVenue[]> => {
    if (!query && !location) return [];

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (location) params.append('location', location);

      const response = await fetch(`/api/jambase/search/venues?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to search venues');
      }

      const data = await response.json();
      return data.venues || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Venue search error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Match events by location and timestamp
  const matchEvents = useCallback(async (
    lat: number,
    lon: number,
    timestamp: string,
    radius = 10
  ): Promise<JamBaseEvent[]> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        timestamp,
        radius: radius.toString(),
      });

      const response = await fetch(`/api/jambase/events/match?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to match events');
      }

      const data = await response.json();
      return data.events || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Event matching failed');
      console.error('Event matching error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Browse upcoming events (metro / city / default — uses JamBase live-tab proxy)
  const getUpcomingEvents = useCallback(async (
    cityOrMetro?: string,
    genre?: string,
    page = 0
  ): Promise<{ events: JamBaseEvent[]; hasMore: boolean }> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        perPage: '30',
        page: String(page + 1),
      });

      if (cityOrMetro?.startsWith('jambase:')) {
        params.set('geoMetroId', cityOrMetro);
      } else if (cityOrMetro) {
        params.set('city', cityOrMetro);
      }
      if (genre) params.set('genreSlug', genre);

      const response = await fetch(`/api/jambase/events/live-tab?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch upcoming events');
      }

      const data = await response.json();
      const list = data.events || [];
      return {
        events: list,
        hasMore: list.length >= 30,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      console.error('Upcoming events error:', err);
      return { events: [], hasMore: false };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get artist tour dates
  const getArtistTourDates = useCallback(async (artistId: string): Promise<JamBaseEvent[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jambase/artist/${artistId}/tourdates`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tour dates');
      }

      const data = await response.json();
      return data.events || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tour dates');
      console.error('Tour dates error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchEvents = useCallback(async (query: string): Promise<JamBaseEvent[]> => {
    if (!query || query.length < 2) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/jambase/search/events?q=${encodeURIComponent(query)}&perPage=20`
      );

      if (!response.ok) {
        throw new Error('Failed to search events');
      }

      const data = await response.json();
      return data.events || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Event search failed');
      console.error('JamBase event search error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    searchArtists,
    searchVenues,
    matchEvents,
    getUpcomingEvents,
    getArtistTourDates,
    searchEvents,
  };
}
