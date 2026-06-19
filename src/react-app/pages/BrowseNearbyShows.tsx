import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import { nearbyShowsApiUrl, readDeviceCoordsForNearbyShows } from '@/react-app/lib/nearby-shows-url';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';

type NearbyShowsApi = {
  events?: Record<string, unknown>[];
  location?: { label?: string; source?: string };
  jambaseNotice?: string | null;
  personalized?: boolean;
};

export default function BrowseNearbyShowsPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<NearbyShowsApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const device = await readDeviceCoordsForNearbyShows();
        const response = await fetch(
          nearbyShowsApiUrl({
            limit: 40,
            latitude: device?.latitude,
            longitude: device?.longitude,
          }),
          { credentials: 'include' },
        );
        setPayload((await response.json()) as NearbyShowsApi);
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
            Shows at Venues Near You
          </h1>
          <p className="mt-2 text-gray-400">
            {nearbyAreaLabel
              ? `Upcoming JamBase listings near ${nearbyAreaLabel}`
              : 'Upcoming shows at venues near you'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-gray-400 py-16">
            {payload?.jambaseNotice?.trim() ||
              'No upcoming shows found near your area right now.'}
          </p>
        ) : (
          <JamBaseEventGrid
            preloadedEvents={events}
            maxEvents={40}
            layout="grid"
            carouselAriaLabel="All upcoming shows near you"
          />
        )}
      </div>
    </div>
  );
}
