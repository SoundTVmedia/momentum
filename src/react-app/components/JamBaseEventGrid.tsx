import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Ticket, Clock, Loader2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { artistPath, venuePath } from '@/shared/app-paths';

export interface JamBaseEventGridProps {
  maxEvents?: number;
  /** Browse by city (resolved via JamBase geographies) */
  city?: string;
  country?: string;
  /** e.g. jambase:1 — overrides city when set */
  geoMetroId?: string;
  genreSlug?: string;
  /** When set, loads that artist's upcoming dates from JamBase */
  artistName?: string;
}

function primaryTicketUrl(ev: Record<string, unknown>): string | null {
  const offers = ev.offers;
  if (!Array.isArray(offers) || !offers.length) {
    return typeof ev.url === 'string' ? ev.url : null;
  }
  const primary = offers.find(
    (o: unknown) =>
      typeof o === 'object' &&
      o !== null &&
      (o as Record<string, unknown>).category === 'ticketingLinkPrimary'
  ) as Record<string, unknown> | undefined;
  const url = (primary?.url ?? (offers[0] as Record<string, unknown>)?.url) as string | undefined;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function headlinerName(ev: Record<string, unknown>): string | null {
  const p = ev.performer;
  if (!Array.isArray(p) || !p.length) return null;
  const head = p.find(
    (x: unknown) =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>)['x-isHeadliner'] === true
  ) as Record<string, unknown> | undefined;
  const pick = head ?? (p[0] as Record<string, unknown>);
  return typeof pick?.name === 'string' ? pick.name : null;
}

function venueLabel(ev: Record<string, unknown>): string {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.name === 'string' ? loc.name : 'Venue TBA';
}

function venueCityLine(ev: Record<string, unknown>): string {
  const loc = ev.location as Record<string, unknown> | undefined;
  const addr = loc?.address as Record<string, unknown> | undefined;
  const city = typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const st =
    typeof region?.alternateName === 'string'
      ? region.alternateName
      : typeof region?.name === 'string'
        ? (region.name as string)
        : '';
  return [city, st].filter(Boolean).join(', ');
}

function headlinerGenre(ev: Record<string, unknown>): string {
  const p = ev.performer;
  if (!Array.isArray(p) || !p.length) return 'Live';
  const head = p.find(
    (x: unknown) =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>)['x-isHeadliner'] === true
  ) as Record<string, unknown> | undefined;
  const pick = head ?? (p[0] as Record<string, unknown>);
  const genres = pick?.genre;
  if (Array.isArray(genres) && genres.length && typeof genres[0] === 'string') {
    return String(genres[0]).replace(/-/g, ' ');
  }
  return 'Concert';
}

export default function JamBaseEventGrid({
  maxEvents = 20,
  city,
  country = 'US',
  geoMetroId,
  genreSlug,
  artistName,
}: JamBaseEventGridProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url: string;
      if (artistName?.trim()) {
        const qs = new URLSearchParams({
          artistName: artistName.trim(),
          perPage: String(Math.min(maxEvents + 8, 40)),
        });
        url = `/api/jambase/events/by-artist-name?${qs}`;
      } else {
        const qs = new URLSearchParams({
          perPage: String(Math.min(maxEvents + 8, 40)),
          page: '1',
        });
        if (geoMetroId) qs.set('geoMetroId', geoMetroId);
        else if (city?.trim()) {
          qs.set('city', city.trim());
          qs.set('country', country);
        }
        if (genreSlug) qs.set('genreSlug', genreSlug);
        url = `/api/jambase/events/live-tab?${qs}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Could not load JamBase events');
      }
      const data = (await res.json()) as { events?: Record<string, unknown>[] };
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [artistName, city, country, geoMetroId, genreSlug, maxEvents]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (iso?: string) => {
    if (!iso) return 'TBA';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        {error}.{' '}
        <button type="button" onClick={load} className="text-amber-300 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!loading && events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No upcoming shows from JamBase for this view.</p>
        <p className="text-gray-500 text-sm mt-2">
          <a
            href="https://www.jambase.com"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="text-amber-400/90 underline"
          >
            Browse JamBase
          </a>
        </p>
      </div>
    );
  }

  const display = events.slice(0, maxEvents);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {display.map((event) => {
          const id =
            typeof event.identifier === 'string' ? event.identifier : String(event.startDate);
          const title = typeof event.name === 'string' ? event.name : 'Show';
          const start = typeof event.startDate === 'string' ? event.startDate : '';
          const image =
            typeof event.image === 'string' && event.image.length > 0
              ? event.image
              : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop';
          const ticket = primaryTicketUrl(event);
          const head = headlinerName(event);
          const vn = venueLabel(event);
          const vLine = venueCityLine(event);

          return (
            <div
              key={id}
              className="group bg-black/40 backdrop-blur-lg border border-amber-500/25 rounded-xl overflow-hidden hover:border-amber-400/50 hover:scale-[1.02] transition-all duration-300"
            >
              <div className="relative">
                <img
                  src={image}
                  alt={title}
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 bg-black/70 backdrop-blur-lg rounded-full text-xs text-white font-medium capitalize">
                    {headlinerGenre(event)}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-bold text-lg text-white mb-2 group-hover:text-amber-300 transition-colors line-clamp-2">
                  {title}
                </h3>

                <div className="space-y-2 mb-4 text-sm">
                  {head && (
                    <button
                      type="button"
                      onClick={() => navigate(artistPath(head))}
                      className="flex items-center space-x-2 text-purple-300 hover:text-purple-200 text-left w-full"
                    >
                      <span className="truncate">{head}</span>
                    </button>
                  )}
                  <div className="flex items-center space-x-2 text-gray-300">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => navigate(venuePath(vn))}
                      className="truncate text-left hover:text-cyan-300 transition-colors"
                    >
                      {vn}
                    </button>
                  </div>
                  {vLine ? <div className="text-xs text-gray-400 pl-6 truncate">{vLine}</div> : null}
                  <div className="flex items-center space-x-2 text-gray-300">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{formatDate(start)}</span>
                  </div>
                  {start ? (
                    <div className="flex items-center space-x-2 text-gray-300">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>{formatTime(start)}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  {ticket ? (
                    <a
                      href={ticket}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-medium hover:scale-[1.02] transition-transform shadow-lg shadow-amber-900/30"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>Tickets</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-gray-500">
        <a
          href="https://www.jambase.com"
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-gray-400 hover:text-amber-300 underline"
        >
          Powered by JamBase
        </a>
      </p>
    </div>
  );
}
