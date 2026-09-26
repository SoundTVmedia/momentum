import { useCallback, useEffect, useState } from 'react';
import { Loader2, Moon } from 'lucide-react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import { Button, Card, Section } from '@/react-app/components/ui';
import { HOME_FEED_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { BROWSE_TONIGHT_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import { useAppPullRefresh } from '@/react-app/hooks/useAppPullRefresh';
import {
  readDeviceCoordsForNearbyShows,
  tonightShowsApiUrl,
} from '@/react-app/lib/nearby-shows-url';
import {
  fetchErrorMessage,
  fetchWithTimeout,
  isFetchNetworkError,
  isFetchTimeoutError,
} from '@/react-app/lib/fetch-with-timeout';

type TonightShowsApi = {
  events?: Record<string, unknown>[];
  location?: { label?: string; source?: string };
  jambaseNotice?: string | null;
};

type TonightShowsSectionProps = {
  maxEvents?: number;
  className?: string;
};

export default function TonightShowsSection({
  maxEvents = 12,
  className = '',
}: TonightShowsSectionProps) {
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const device = await readDeviceCoordsForNearbyShows();
        const response = await fetchWithTimeout(
          tonightShowsApiUrl({
            limit: maxEvents,
            latitude: device?.latitude,
            longitude: device?.longitude,
          }),
          { credentials: 'include' },
          attempt === 0 ? 28_000 : 35_000,
        );
        if (!response.ok) {
          throw new Error(`Tonight shows request failed (${response.status})`);
        }
        const data = (await response.json()) as TonightShowsApi;
        setEvents(Array.isArray(data.events) ? data.events : []);
        const notice =
          typeof data.jambaseNotice === 'string' && data.jambaseNotice.trim()
            ? data.jambaseNotice.trim()
            : null;
        setMessage(
          notice ??
            ((data.events?.length ?? 0) === 0
              ? 'No shows tonight near you right now.'
              : null),
        );
        setLoading(false);
        return;
      } catch (error) {
        lastError = error;
        const detail = fetchErrorMessage(error);
        console.warn(
          `TonightShowsSection load attempt ${attempt + 1} failed: ${detail}`,
        );
        if (attempt === 0 && isFetchNetworkError(error)) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          continue;
        }
        break;
      }
    }

    if (silent) {
      setLoading(false);
      return;
    }

    setEvents([]);
    setMessage(
      isFetchTimeoutError(lastError)
        ? 'Tonight’s shows took too long to load. Try again in a moment.'
        : 'Could not load tonight’s shows.',
    );
    setLoading(false);
  }, [maxEvents]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadSilent = useCallback(() => load({ silent: true }), [load]);
  useAppPullRefresh(reloadSilent);

  const viewAll = (
    <Button to={BROWSE_TONIGHT_SHOWS_PATH} variant="quiet" size="sm">
      View all
    </Button>
  );

  if (loading) {
    return (
      <Section
        id="shows-tonight"
        title="Shows Tonight"
        description="Live music happening near you tonight."
        action={viewAll}
        className={className || undefined}
      >
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" aria-hidden />
        </div>
      </Section>
    );
  }

  if (events.length === 0) {
    return (
      <Section
        id="shows-tonight"
        title="Shows Tonight"
        description="Live music happening near you tonight."
        action={viewAll}
        className={className || undefined}
      >
        <Card className="text-center">
          <Moon className="mx-auto mb-4 h-12 w-12 text-momentum-flare" aria-hidden />
          <p className="mx-auto max-w-lg leading-relaxed text-gray-300">
            {message ?? 'No shows tonight near you right now.'}
          </p>
        </Card>
      </Section>
    );
  }

  return (
    <Section
      id="shows-tonight"
      title="Shows Tonight"
      description="Live music happening near you tonight."
      action={viewAll}
      className={className || undefined}
    >
      <JamBaseEventGrid
        preloadedEvents={events}
        maxEvents={events.length}
        layout="carousel"
        carouselAriaLabel="Shows tonight near you"
        carouselClassName={HOME_FEED_CAROUSEL_BLEED}
        showInProgressBadge
      />
    </Section>
  );
}
