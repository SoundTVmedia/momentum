import { useState, useCallback } from 'react';
import type { TicketmasterEvent } from '@/shared/ticketmaster-events';

export type { TicketmasterEvent };

export function useTicketmaster() {
  const [events, setEvents] = useState<TicketmasterEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchEvents = useCallback(async (params: {
    q?: string;
    city?: string;
    state?: string;
    startDate?: string;
    endDate?: string;
    genre?: string;
    page?: number;
    lat?: number;
    lon?: number;
    radiusMiles?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params.q) queryParams.append('q', params.q);
      if (params.city) queryParams.append('city', params.city);
      if (params.state) queryParams.append('state', params.state);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.genre) queryParams.append('genre', params.genre);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.lat != null && params.lon != null) {
        queryParams.append('lat', String(params.lat));
        queryParams.append('lon', String(params.lon));
        queryParams.append('radius', String(params.radiusMiles ?? 150));
      }

      const response = await fetch(`/api/ticketmaster/events/search?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to search events');
      }

      const data = await response.json();
      setEvents(data.events || []);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search events';
      setError(errorMessage);
      console.error('Ticketmaster search error:', err);
      return { events: [], page: {} };
    } finally {
      setLoading(false);
    }
  }, []);

  const getEventById = useCallback(async (eventId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ticketmaster/events/${eventId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch event';
      setError(errorMessage);
      console.error('Ticketmaster event fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const trackTicketClick = useCallback(async (
    eventId: string,
    eventName: string,
    ticketUrl: string,
    price?: number,
    referrerId?: string,
    relatedClipId?: number,
    venueName?: string,
  ) => {
    try {
      await fetch('/api/ticketmaster/track-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event_id: eventId,
          event_name: eventName,
          venue_name: venueName ?? null,
          ticket_url: ticketUrl,
          ticket_price: price ?? 0,
          quantity: 1,
          referrer_user_id: referrerId ?? null,
          related_clip_id: relatedClipId ?? null,
        }),
      });
    } catch (err) {
      console.error('Failed to track ticket click:', err);
    }
  }, []);

  return {
    events,
    loading,
    error,
    searchEvents,
    getEventById,
    trackTicketClick,
  };
}
