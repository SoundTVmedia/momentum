import { useCallback, useEffect, useState } from 'react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import {
  pickClosestUpcomingJamBaseShow,
  type JamBaseShowPick,
} from '@/shared/jambase-events';

type ClipPlaybackTicketsState = {
  show: JamBaseShowPick | null;
  loading: boolean;
  openTickets: () => void;
};

async function fetchArtistUpcomingShows(
  artistName: string,
): Promise<Record<string, unknown>[]> {
  const qs = new URLSearchParams({
    artistName: artistName.trim(),
    perPage: '40',
  });
  const res = await fetch(`/api/jambase/events/by-artist-name?${qs}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: Record<string, unknown>[] };
  return data.events ?? [];
}

export function useClipPlaybackTickets(artistName?: string | null): ClipPlaybackTicketsState {
  const { getDeviceCoordinates } = useGeolocation();
  const [show, setShow] = useState<JamBaseShowPick | null>(null);
  const [loading, setLoading] = useState(true);

  const artist = artistName?.trim() ?? '';

  useEffect(() => {
    if (!artist) {
      setShow(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setShow(null);

      try {
        const geo = await getDeviceCoordinates();
        const events = await fetchArtistUpcomingShows(artist);
        const pick = pickClosestUpcomingJamBaseShow(
          events,
          geo?.latitude,
          geo?.longitude,
        );
        if (!cancelled) setShow(pick);
      } catch (err) {
        console.error('Clip playback tickets:', err);
        if (!cancelled) setShow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artist, getDeviceCoordinates]);

  const openTickets = useCallback(() => {
    if (!show?.ticketUrl) return;
    window.open(show.ticketUrl, '_blank', 'noopener,noreferrer');
  }, [show]);

  return { show, loading, openTickets };
}
