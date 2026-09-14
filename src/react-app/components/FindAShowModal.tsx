import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Calendar, Loader2, MapPin, Search, X } from 'lucide-react';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import { displayMediaUrl } from '@/shared/media-proxy';
import { pastShowClipsPath, showClipsPath } from '@/shared/app-paths';
import { jamBaseEventUpcomingOrInProgress } from '@/shared/jambase-event-day';
import {
  formatJamBaseEventDate,
  jamBaseEventArtistName,
  jamBaseEventHeadliner,
  jamBaseEventId,
  jamBaseEventImageUrl,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
} from '@/shared/jambase-events';
import { artistAtVenueTitle, jamBaseEventTitle } from '@/shared/event-title';
import { isFeedbackLibraryShow } from '@/shared/library-shows';
import { computeShowId } from '@/shared/show-id';

type FindAShowModalProps = {
  onClose: () => void;
};

function eventVenueId(ev: Record<string, unknown>): string | undefined {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.identifier === 'string' && loc.identifier.trim()
    ? loc.identifier.trim()
    : undefined;
}

function eventArtistId(ev: Record<string, unknown>): string | undefined {
  const head = jamBaseEventHeadliner(ev);
  return typeof head?.identifier === 'string' && head.identifier.trim()
    ? head.identifier.trim()
    : undefined;
}

function eventShowHref(ev: Record<string, unknown>): string {
  const artistName = jamBaseEventArtistName(ev);
  const venueName = jamBaseEventVenueName(ev);
  const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';
  if (isFeedbackLibraryShow(ev)) {
    const libraryShowId =
      typeof ev['x-feedbackShowId'] === 'string' ? ev['x-feedbackShowId'] : jamBaseEventId(ev);
    return pastShowClipsPath({
      show_id: libraryShowId,
      jambase_event_id: jamBaseEventId(ev) || null,
      artist_name: artistName,
      venue_name: venueName === 'Venue TBA' ? null : venueName,
      show_date: startDate || null,
      event_title: jamBaseEventTitle(ev),
    });
  }
  const showId =
    jamBaseEventId(ev) ||
    computeShowId({
      jambase_event_id: jamBaseEventId(ev) || null,
      artist_name: artistName,
      venue_name: venueName === 'Venue TBA' ? null : venueName,
      timestamp: startDate,
    });
  return showClipsPath(artistName, showId);
}

export default function FindAShowModal({ onClose }: FindAShowModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 350);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (debounced.length < 2) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await apiFetch(
          `/api/jambase/search/events?q=${encodeURIComponent(debounced)}&includePast=1&limit=24`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as { events?: Record<string, unknown>[] };
        if (!cancelled) setEvents(data.events ?? []);
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(apiFetchErrorMessage(err, 'Could not search shows'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const openEvent = (ev: Record<string, unknown>) => {
    const artistName = jamBaseEventArtistName(ev);
    const venueName = jamBaseEventVenueName(ev);
    const venueLabel = venueName === 'Venue TBA' ? '' : venueName;
    const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';
    const eventId = jamBaseEventId(ev);
    const libraryShow = isFeedbackLibraryShow(ev);
    const upcoming = !libraryShow && jamBaseEventUpcomingOrInProgress(ev);

    onClose();

    if (libraryShow || upcoming) {
      navigate(eventShowHref(ev));
      return;
    }

    navigate('/upload?archive=true', {
      state: {
        fromPhotoLibrary: true,
        showData: {
          jambase_event_id: eventId || undefined,
          jambase_venue_id: eventVenueId(ev),
          jambase_artist_id: eventArtistId(ev),
          event_title:
            jamBaseEventTitle(ev) ?? artistAtVenueTitle(artistName, venueLabel) ?? undefined,
          artist_name: artistName || undefined,
          venue_name: venueLabel || undefined,
          location: jamBaseEventVenueCityLine(ev) || undefined,
          start_date: startDate || undefined,
        },
      },
    });
  };

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-momentum-rose/20 bg-black/95 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-a-show-title"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="find-a-show-title" className="text-xl font-bold text-white">
            Find a Show
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-400">
          Search upcoming JamBase dates and past shows from the FEEDBACK library. Pick a past
          JamBase date to upload a clip from a show that already happened.
        </p>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artist, venue, or show name"
            className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-10 pr-3 text-base text-white placeholder:text-white/40"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Searching shows…
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-red-400">{error}</p>
          ) : debounced.length < 2 ? (
            <p className="py-6 text-sm text-gray-500">Type at least two letters to search.</p>
          ) : events.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">No matching shows.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((ev, index) => {
                const artistName = jamBaseEventArtistName(ev);
                const venueName = jamBaseEventVenueName(ev);
                const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';
                const upcoming =
                  !isFeedbackLibraryShow(ev) && jamBaseEventUpcomingOrInProgress(ev);
                const image = jamBaseEventImageUrl(ev);
                const title =
                  jamBaseEventTitle(ev) ??
                  artistAtVenueTitle(artistName, venueName) ??
                  (artistName || 'Show');
                const key = jamBaseEventId(ev) || `${title}-${startDate}-${index}`;

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => openEvent(ev)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
                    >
                      {image ? (
                        <img
                          src={displayMediaUrl(image)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-momentum-ember/30">
                          <Calendar className="h-5 w-5 text-momentum-flare" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-white">{title}</span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {[venueName, jamBaseEventVenueCityLine(ev)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {formatJamBaseEventDate(startDate)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                          upcoming
                            ? 'bg-white/10 text-white/80'
                            : 'bg-momentum-ember/25 text-momentum-flare'
                        }`}
                      >
                        {upcoming ? 'Upcoming' : 'Past'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
