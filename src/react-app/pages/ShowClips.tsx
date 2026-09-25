import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Calendar, MapPin, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import ClipPosterImage from '@/react-app/components/ClipPosterImage';
import EventTicketActions from '@/react-app/components/EventTicketActions';
import ShowSetlistPanel from '@/react-app/components/ShowSetlistPanel';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { apiFetch } from '@/react-app/lib/apiFetch';
import {
  artistPath,
  eventClipsPath,
  festivalPageHrefFromEvent,
  showClipsPath,
  venuePath,
} from '@/shared/app-paths';
import { isJamBaseFestivalEvent } from '@/shared/jambase-festival';
import { isJamBaseEventId, pickClipForShowHeader } from '@/shared/show-id';
import { jamBaseEventTitle } from '@/shared/event-title';
import { jamBaseEventIsConcluded, jamBaseEventUpcomingOrInProgress } from '@/shared/jambase-event-day';
import {
  formatJamBaseEventDate,
  jamBaseEventTicketUrl,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
} from '@/shared/jambase-events';
import { jamBaseEventSetlist, type StoredShowPage } from '@/shared/jambase-setlist';
import { pastShowSummaryToJamBaseEvent } from '@/shared/show-marks';
import ShowMarkButtons from '@/react-app/components/ShowMarkButtons';
import EventShowRating from '@/react-app/components/EventShowRating';
import { searchPhraseFromSlug, normalizedSlugFromRouteParam, titleCaseWords } from '@/shared/jambase-slug';
import {
  fetchAllShowClips,
  type ShowClipsSort,
} from '@/react-app/lib/show-clips-pagination';

export default function ShowClipsPage() {
  const { artistName, showId } = useParams<{ artistName: string; showId: string }>();
  const navigate = useNavigate();
  const artistLabel = artistName
    ? titleCaseWords(searchPhraseFromSlug(normalizedSlugFromRouteParam(artistName)))
    : '';
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [storedShow, setStoredShow] = useState<StoredShowPage | null>(null);
  const [fallbackEvent, setFallbackEvent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<ShowClipsSort>('time_posted');
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showModalFeed, setShowModalFeed] = useState<ClipWithUser[] | null>(null);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    if (!artistName || !showId) {
      setClips([]);
      setStoredShow(null);
      setLoading(false);
      return;
    }

    const generation = ++fetchGenerationRef.current;
    const controller = new AbortController();
    setClips([]);
    setStoredShow(null);
    setFallbackEvent(null);
    setSelectedClip(null);
    setShowModalFeed(null);
    setLoading(true);

    void fetchAllShowClips({
      artistName,
      showId,
      sortBy,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted || generation !== fetchGenerationRef.current) return;
        const requestedId = (() => {
          try {
            return decodeURIComponent(showId).trim();
          } catch {
            return showId.trim();
          }
        })();
        const festivalTitle = result.clips
          .map((clip) => (typeof clip.event_title === 'string' ? clip.event_title.trim() : ''))
          .find((title) => title && isJamBaseFestivalEvent({ name: title }));
        if (festivalTitle) {
          navigate(eventClipsPath(festivalTitle), { replace: true });
          return;
        }
        const canonicalId = result.canonical_show_id?.trim() || '';
        if (canonicalId && canonicalId !== requestedId) {
          navigate(showClipsPath(artistName, canonicalId), { replace: true });
          return;
        }
        setClips(result.clips);
        setStoredShow(result.show);
      })
      .catch((error) => {
        if (controller.signal.aborted || generation !== fetchGenerationRef.current) return;
        console.error('Failed to fetch show clips:', error);
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [artistName, showId, sortBy, navigate]);

  const headerClip = pickClipForShowHeader(clips);
  const clipEventId = (() => {
    if (typeof showId === 'string' && isJamBaseEventId(showId)) {
      try {
        return decodeURIComponent(showId).trim();
      } catch {
        return showId.trim();
      }
    }
    return typeof headerClip?.jambase_event_id === 'string'
      ? headerClip.jambase_event_id.trim()
      : '';
  })();

  useEffect(() => {
    if (loading) return;
    if (storedShow) {
      setFallbackEvent(null);
      return;
    }
    const lookupId = clipEventId || (typeof showId === 'string' ? showId.trim() : '');
    if (!lookupId) {
      setFallbackEvent(null);
      return;
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await apiFetch(`/api/jambase/events/id/${encodeURIComponent(lookupId)}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          if (!ac.signal.aborted) setFallbackEvent(null);
          return;
        }
        const data = (await res.json()) as { event?: Record<string, unknown> };
        if (!ac.signal.aborted) {
          setFallbackEvent(data.event && typeof data.event === 'object' ? data.event : null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!ac.signal.aborted) setFallbackEvent(null);
      }
    })();
    return () => ac.abort();
  }, [loading, storedShow, showId, clipEventId]);

  const clipEvent =
    headerClip
      ? pastShowSummaryToJamBaseEvent({
          event_title:
            headerClip.event_title?.trim() ||
            [headerClip.artist_name, headerClip.venue_name].filter(Boolean).join(' at ') ||
            artistLabel ||
            'Show',
          artist_name: headerClip.artist_name?.trim() || artistLabel || '',
          show_date: headerClip.timestamp ?? '',
          venue_name: headerClip.venue_name,
          venue_location: headerClip.location,
          jambase_event_id:
            (typeof showId === 'string' && isJamBaseEventId(showId) ? showId : null) ??
            headerClip.jambase_event_id ??
            showId,
          jambase_venue_id: headerClip.jambase_venue_id,
          jambase_artist_id: headerClip.jambase_artist_id,
        })
      : null;
  const markEvent = storedShow?.event ?? fallbackEvent ?? clipEvent;
  const pastShow = Boolean(markEvent && jamBaseEventIsConcluded(markEvent));
  const upcoming = Boolean(markEvent && jamBaseEventUpcomingOrInProgress(markEvent));
  const ticketUrl = upcoming && markEvent ? jamBaseEventTicketUrl(markEvent) : null;
  const pageTitle = (markEvent && jamBaseEventTitle(markEvent)) || artistLabel || artistName || 'Show';
  const jbVenue = markEvent ? jamBaseEventVenueName(markEvent) : '';
  const venueName =
    jbVenue && jbVenue !== 'Venue TBA' ? jbVenue : headerClip ? headerClip.venue_name : '';
  const location =
    (markEvent && jamBaseEventVenueCityLine(markEvent)) ||
    (headerClip ? headerClip.location : '');
  const startDate = typeof markEvent?.startDate === 'string' ? markEvent.startDate : '';
  const setlist =
    storedShow && storedShow.setlist.length > 0
      ? storedShow.setlist
      : jamBaseEventSetlist(markEvent);
  const showDate = startDate
    ? formatJamBaseEventDate(startDate)
    : headerClip?.timestamp
      ? new Date(headerClip.timestamp).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
  const festivalHref = festivalPageHrefFromEvent(markEvent, pageTitle);

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <button
          onClick={() =>
            navigate(festivalHref || (artistName ? artistPath(artistName) : '/'))
          }
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>
            {festivalHref
              ? `Back to ${pageTitle} festival`
              : `Back to ${artistLabel || 'artist'}`}
          </span>
        </button>

        {/* Show Header */}
        <div className="bg-gradient-to-r from-momentum-ember/20 to-momentum-flare/12 border border-momentum-ember/25 rounded-xl p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              {festivalHref ? (
                <button
                  type="button"
                  onClick={() => navigate(festivalHref)}
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-momentum-flare mb-2 hover:text-white transition-colors"
                >
                  Festival page
                </button>
              ) : null}
              <h1 className="min-w-0 text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                {pageTitle}
              </h1>
            </div>
            <EventShowRating
              showId={typeof markEvent?.identifier === 'string' ? markEvent.identifier : showId}
              pastShow={pastShow}
            />
          </div>
          
          <div className="flex flex-wrap gap-4 text-gray-300 mb-4">
            {showDate && (
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-momentum-flare" />
                <span>{showDate}</span>
              </div>
            )}
            {venueName && (
              <button
                type="button"
                onClick={() => navigate(venuePath(venueName))}
                className="flex items-center space-x-2 hover:text-white transition-colors text-left"
              >
                <MapPin className="w-5 h-5 text-momentum-ember shrink-0" />
                <span>{venueName}</span>
                {location && <span className="text-gray-500">• {location}</span>}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-400">
                {clips.length} moment{clips.length !== 1 ? 's' : ''}
              </span>
              {markEvent ? (
                <ShowMarkButtons event={markEvent} showUploadClip className="shrink-0" />
              ) : null}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ShowClipsSort)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-momentum-flare"
            >
              <option value="time_posted">Recorded (setlist order)</option>
              <option value="most_liked">Most Liked</option>
            </select>
          </div>
          {ticketUrl ? (
            <EventTicketActions
              ticketUrl={ticketUrl}
              eventTitle={pageTitle}
              className="mt-4 w-full max-w-xl"
            />
          ) : null}
          {festivalHref ? (
            <button
              type="button"
              onClick={() => navigate(festivalHref)}
              className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-all"
            >
              View festival page
            </button>
          ) : null}
        </div>

        <div
          className={
            pastShow && setlist.length > 0
              ? 'flex flex-col lg:flex-row lg:items-start lg:gap-8'
              : undefined
          }
        >
          {pastShow && setlist.length > 0 ? (
            <ShowSetlistPanel songs={setlist} className="mb-6 lg:mb-0 lg:order-2 lg:w-72 xl:w-80 shrink-0" />
          ) : null}

          <div className="min-w-0 flex-1 lg:order-1">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
              </div>
            ) : clips.length === 0 ? (
              <div className="text-center py-12 glass-panel border border-momentum-rose/20 rounded-xl">
                <p className="text-gray-400 text-lg">
                  {upcoming ? "This show hasn't happened yet." : 'No clips found for this show'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {clips.map((clip, index) => (
                  <div
                    key={clipListItemKey(clip, index)}
                    onClick={() => {
                      setSelectedClip(clip);
                      setShowModalFeed(clips.length > 1 ? clips : null);
                    }}
                    className="glass-panel border border-momentum-rose/20 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-all cursor-pointer group"
                  >
                    <div className="relative aspect-video">
                      <ClipPosterImage
                        clip={clip}
                        alt="Concert moment"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>

                    <div className="p-4">
                      {clip.content_description && (
                        <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                          {clip.content_description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>{clip.likes_count} likes</span>
                        <span>{clip.views_count} views</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => {
            setSelectedClip(null);
            setShowModalFeed(null);
          }}
          feedNavigation={
            showModalFeed && showModalFeed.length > 1
              ? { clips: showModalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      )}
    </div>
  );
}
