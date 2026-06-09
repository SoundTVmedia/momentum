import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import Header from '@/react-app/components/Header';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import EventTicketActions from '@/react-app/components/EventTicketActions';
import { artistPath } from '@/shared/app-paths';
import { Calendar, MapPin } from 'lucide-react';

type D1Concert = {
  id: number;
  artist_name: string;
  artist_image: string;
  venue_name: string;
  venue_location: string;
  date: string;
  ticket_url: string;
};

type ConcertsApi = {
  concerts?: D1Concert[];
  events?: Record<string, unknown>[];
  personalized?: boolean;
  message?: string;
};

function D1ConcertBrowseCard({
  concert,
  onArtist,
}: {
  concert: D1Concert;
  onArtist: (name: string) => void;
}) {

  return (
    <div className="group glass-panel rounded-xl overflow-hidden hover:border-momentum-flare/50 transition-colors flex h-full min-h-[19rem] w-full flex-col">
      <button
        type="button"
        onClick={() => onArtist(concert.artist_name)}
        className="relative shrink-0 h-40 overflow-hidden block w-full text-left"
        aria-label={`View ${concert.artist_name}`}
      >
        {concert.artist_image ? (
          <img
            src={concert.artist_image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-white/5" aria-hidden />
        )}
      </button>

      <div className="p-5 flex flex-col flex-1 min-h-0">
        <button
          type="button"
          onClick={() => onArtist(concert.artist_name)}
          className="text-lg font-bold text-white truncate text-left hover:text-momentum-flare/90 transition-colors"
        >
          {concert.artist_name}
        </button>

        <div className="space-y-1.5 text-sm flex-1 mt-2 leading-tight">
          <div className="flex items-start space-x-2 text-gray-300">
            <MapPin className="w-4 h-4 text-momentum-flare flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{concert.venue_name}</div>
              <div className="text-xs text-gray-400 truncate">{concert.venue_location}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-gray-300">
            <Calendar className="w-4 h-4 text-momentum-rose flex-shrink-0" />
            <span>
              {new Date(concert.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-2 min-h-[44px] flex items-end w-full">
          {concert.ticket_url ? (
            <EventTicketActions
              ticketUrl={concert.ticket_url}
              eventTitle={concert.artist_name}
              className="w-full"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function BrowseFavoriteShowsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [payload, setPayload] = useState<ConcertsApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/personalization/concerts?limit=40', {
          credentials: 'include',
        });
        setPayload((await response.json()) as ConcertsApi);
      } catch {
        setPayload({ personalized: false, concerts: [], events: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isPending, navigate]);

  if (isPending || (loading && !user)) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    );
  }

  const jbEvents = payload?.events ?? [];
  const d1Concerts = payload?.concerts ?? [];
  const hasShows = jbEvents.length > 0 || d1Concerts.length > 0;

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
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">Nearest Shows</h1>
          <p className="mt-2 text-gray-400">Tour dates from your favorite artists</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : !hasShows ? (
          <p className="text-center text-gray-400 py-16">
            {payload?.message ?? 'No upcoming shows from your favorite artists right now.'}
          </p>
        ) : jbEvents.length > 0 ? (
          <JamBaseEventGrid
            preloadedEvents={jbEvents}
            maxEvents={40}
            layout="grid"
            carouselAriaLabel="All upcoming shows from your favorite artists"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {d1Concerts.map((concert) => (
              <D1ConcertBrowseCard
                key={concert.id}
                concert={concert}
                onArtist={(name) => navigate(artistPath(name))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
