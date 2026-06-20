import { useCallback, useEffect, useState } from 'react';
import { Loader2, Moon } from 'lucide-react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import {
  readDeviceCoordsForNearbyShows,
  tonightShowsApiUrl,
} from '@/react-app/lib/nearby-shows-url';

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
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const device = await readDeviceCoordsForNearbyShows();
      const response = await fetch(
        tonightShowsApiUrl({
          limit: maxEvents,
          latitude: device?.latitude,
          longitude: device?.longitude,
        }),
        { credentials: 'include', signal: AbortSignal.timeout(22_000) },
      );
      const data = (await response.json()) as TonightShowsApi;
      setEvents(Array.isArray(data.events) ? data.events : []);
      const label =
        typeof data.location?.label === 'string' && data.location.label.trim()
          ? data.location.label.trim()
          : null;
      setLocationLabel(label);
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
    } catch (error) {
      console.error('TonightShowsSection load failed', error);
      setEvents([]);
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      setMessage(
        timedOut
          ? 'Tonight’s shows took too long to load. Try again in a moment.'
          : 'Could not load tonight’s shows.',
      );
    } finally {
      setLoading(false);
    }
  }, [maxEvents]);

  useEffect(() => {
    void load();
  }, [load]);

  const areaLabel =
    locationLabel && locationLabel.length > 0 ? locationLabel : 'you';

  if (loading) {
    return (
      <div className={`${HOME_FEED_SECTION_CLASS} flex justify-center py-8 ${className}`}>
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" aria-hidden />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <section className={`${HOME_FEED_SECTION_CLASS} ${className}`}>
        <SectionHeading
          title="Shows Tonight"
          subtitle={`Shows happening near ${areaLabel} today — mark Going up to 4 hours after doors`}
          size="section"
        />
        <div className="glass-highlight rounded-xl p-8 text-center">
          <Moon className="w-12 h-12 text-momentum-flare mx-auto mb-4" aria-hidden />
          <p className="text-gray-300 max-w-lg mx-auto leading-relaxed">
            {message ?? 'No shows tonight near you right now.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${HOME_FEED_SECTION_CLASS} ${className}`}>
      <SectionHeading
        title="Shows Tonight"
        subtitle={`Shows near ${areaLabel} today — including ones already underway. Mark Going up to 4 hours after start.`}
        size="section"
      />
      <JamBaseEventGrid
        preloadedEvents={events}
        maxEvents={events.length}
        layout="carousel"
        carouselAriaLabel="Shows tonight near you"
        carouselClassName={HOME_FEED_CAROUSEL_BLEED}
        showInProgressBadge
      />
    </section>
  );
}
