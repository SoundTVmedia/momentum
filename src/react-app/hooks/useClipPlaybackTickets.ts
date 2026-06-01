import { useCallback, useEffect, useState } from 'react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import { useTicketmaster } from '@/react-app/hooks/useTicketmaster';
import {
  pickClosestUpcomingTicketmasterEvent,
  pickFirstUpcomingTicketmasterEvent,
  ticketmasterSearchEndDateIso,
  ticketmasterSearchStartDateIso,
  type TicketmasterEvent,
} from '@/shared/ticketmaster-events';

type ClipPlaybackTicketsState = {
  ticketEvent: TicketmasterEvent | null;
  loading: boolean;
  /** User denied or blocked location and no cached city. */
  needsLocation: boolean;
  /** Search finished but no upcoming shows with ticket URLs. */
  noShows: boolean;
  openTickets: () => Promise<void>;
  enableLocation: () => Promise<void>;
};

export function useClipPlaybackTickets(artistName?: string | null): ClipPlaybackTicketsState {
  const { location, getDeviceCoordinates, requestLocation } = useGeolocation();
  const { searchEvents, trackTicketClick } = useTicketmaster();
  const [ticketEvent, setTicketEvent] = useState<TicketmasterEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [noShows, setNoShows] = useState(false);

  const resolveTickets = useCallback(
    async (forceLocationRequest = false) => {
      setLoading(true);
      setNeedsLocation(false);
      setNoShows(false);
      setTicketEvent(null);

      let geo = location;
      if (!geo?.latitude) {
        geo = (await getDeviceCoordinates()) ?? geo;
      }
      if (!geo?.latitude && !geo?.city && forceLocationRequest) {
        geo = (await requestLocation()) ?? geo;
      }

      if (!geo?.latitude && !geo?.city) {
        setNeedsLocation(true);
        setLoading(false);
        return;
      }

      const searchParams = {
        city: geo.city || undefined,
        state: geo.state || undefined,
        startDate: ticketmasterSearchStartDateIso(),
        endDate: ticketmasterSearchEndDateIso(),
        lat: geo.latitude,
        lon: geo.longitude,
        radiusMiles: 150,
      };

      const pickFromResult = (raw: { events?: unknown[] }) => {
        const events = (raw?.events ?? []) as TicketmasterEvent[];
        if (geo.latitude != null && geo.longitude != null) {
          return pickClosestUpcomingTicketmasterEvent(events, geo.latitude, geo.longitude);
        }
        return pickFirstUpcomingTicketmasterEvent(events);
      };

      const artistQuery = artistName?.trim() || undefined;
      const result = await searchEvents({ ...searchParams, q: artistQuery });
      const pick = pickFromResult(result);

      setTicketEvent(pick);
      setNoShows(!pick && Boolean(artistQuery));
      setLoading(false);
    },
    [artistName, getDeviceCoordinates, location, requestLocation, searchEvents],
  );

  useEffect(() => {
    void resolveTickets(false);
  }, [resolveTickets]);

  const enableLocation = useCallback(async () => {
    await requestLocation();
    await resolveTickets(true);
  }, [requestLocation, resolveTickets]);

  const openTickets = useCallback(async () => {
    if (!ticketEvent?.url) return;
    await trackTicketClick(
      ticketEvent.id,
      ticketEvent.name,
      ticketEvent.url,
      ticketEvent.priceRanges?.[0]?.min,
    );
    window.open(ticketEvent.url, '_blank', 'noopener,noreferrer');
  }, [ticketEvent, trackTicketClick]);

  return {
    ticketEvent,
    loading,
    needsLocation,
    noShows,
    openTickets,
    enableLocation,
  };
}
