import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import { readDeviceCoordsForNearbyShows, tonightShowsApiUrl } from '@/react-app/lib/nearby-shows-url';
import { fetchWithTimeout } from '@/react-app/lib/fetch-with-timeout';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';

type TonightShowsApi = {
  events?: Record<string, unknown>[];
  location?: { label?: string; source?: string };
  jambaseNotice?: string | null;
  personalized?: boolean;
};

export default function BrowseTonightShowsPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<TonightShowsApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const device = await readDeviceCoordsForNearbyShows();
        const response = await fetchWithTimeout(
          tonightShowsApiUrl({
            limit: 40,
            latitude: device?.latitude,
            longitude: device?.longitude,
          }),
          { credentials: 'include' },
          28_000,
        );
        setPayload((await response.json()) as TonightShowsApi);
      } catch {
        setPayload({ personalized: false, events: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const events = payload?.events ?? [];
  const locationLabel =
    typeof payload?.location?.label === 'string' && payload.location.label.trim()
      ? payload.location.label.trim()
      : null;
  const nearbyAreaLabel =
    payload?.location?.source === 'device' ? 'your current location' : locationLabel;

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to feed</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">
            Shows Tonight
          </h1>
          <p className="mt-2 text-gray-400">
            {nearbyAreaLabel
              ? `All JamBase listings near ${nearbyAreaLabel} happening today`
              : 'All shows at venues near you happening today'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-gray-400 py-16">
            {payload?.jambaseNotice?.trim() ||
              'No shows tonight near your area right now.'}
          </p>
        ) : (
          <JamBaseEventGrid
            preloadedEvents={events}
            maxEvents={40}
            layout="grid"
            carouselAriaLabel="All shows tonight near you"
            showInProgressBadge
          />
        )}
      </div>
    </div>
  );
}
