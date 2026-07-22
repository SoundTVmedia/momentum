import { useEffect, useState } from 'react';
import { apiJson } from '@/src/lib/api/client';
import { primeLocationOnUserGesture } from '@/src/lib/location';
import {
  pickClosestUpcomingJamBaseShow,
  type JamBaseShowPick,
} from '@shared/jambase-events';

type State = {
  show: JamBaseShowPick | null;
  loading: boolean;
};

export function useClipPlaybackTickets(artistName?: string | null): State {
  const artist = artistName?.trim() ?? '';
  const [show, setShow] = useState<JamBaseShowPick | null>(null);
  const [loading, setLoading] = useState(Boolean(artist));

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
        const [loc, data] = await Promise.all([
          primeLocationOnUserGesture().catch(() => null),
          apiJson<{ events?: Record<string, unknown>[] }>(
            `/api/jambase/events/by-artist-name?${new URLSearchParams({
              artistName: artist,
              perPage: '40',
            }).toString()}`,
          ).catch(() => ({ events: [] as Record<string, unknown>[] })),
        ]);
        if (cancelled) return;
        const pick = pickClosestUpcomingJamBaseShow(
          data.events ?? [],
          loc?.coords?.latitude,
          loc?.coords?.longitude,
        );
        setShow(pick);
      } catch {
        if (!cancelled) setShow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artist]);

  return { show, loading };
}
