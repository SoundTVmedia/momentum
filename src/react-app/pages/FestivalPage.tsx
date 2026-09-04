import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Calendar, ExternalLink, Globe, Loader2, MapPin, Music } from 'lucide-react';
import Header from '@/react-app/components/Header';
import SectionHeading from '@/react-app/components/SectionHeading';
import EventTicketActions from '@/react-app/components/EventTicketActions';
import ShowMarkButtons from '@/react-app/components/ShowMarkButtons';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import ClipModal from '@/react-app/components/ClipModal';
import { useAutoRetryPageLoad } from '@/react-app/hooks/useAutoRetryPageLoad';
import { fetchJsonWithRetry } from '@/react-app/lib/fetch-json-with-retry';
import { HOME_FEED_SECTION_CLASS, PAGE_BLOCK_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { artistPath, apiFestivalPath, venuePath } from '@/shared/app-paths';
import {
  festivalPageToJamBaseEvent,
  formatFestivalDateRange,
  type FestivalLineupArtist,
  type FestivalPageFestival,
} from '@/shared/jambase-festival';
import { displayMediaUrl } from '@/shared/media-proxy';
import type { ClipWithUser } from '@/shared/types';

const FALLBACK_FEST_IMAGE =
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=800&fit=crop';
const FALLBACK_ARTIST_IMAGE =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

interface FestivalData {
  festival: FestivalPageFestival;
  artists: FestivalLineupArtist[];
  clips: ClipWithUser[];
  jambase_attribution?: boolean;
}

export default function FestivalPage() {
  const { festivalName } = useParams<{ festivalName: string }>();
  const navigate = useNavigate();
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [modalFeed, setModalFeed] = useState<ClipWithUser[] | null>(null);

  const loadFestivalPage = useCallback(
    async (signal: AbortSignal): Promise<FestivalData> => {
      if (!festivalName) throw new Error('Missing festival');
      return fetchJsonWithRetry<FestivalData>(
        apiFestivalPath(festivalName),
        { signal },
        {
          isValid: (payload) =>
            Boolean(
              payload?.festival &&
                typeof payload.festival === 'object' &&
                typeof payload.festival.name === 'string' &&
                payload.festival.name.trim().length > 0,
            ),
        },
      );
    },
    [festivalName],
  );

  const { data, loading, slowLoad } = useAutoRetryPageLoad({
    enabled: Boolean(festivalName),
    load: loadFestivalPage,
    validate: (payload) => Boolean(payload.festival?.name?.trim()),
  });

  if (loading || !data?.festival) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
          {slowLoad ? (
            <p className="mt-4 text-sm text-gray-400">Still loading this festival…</p>
          ) : null}
        </div>
      </div>
    );
  }

  const { festival, artists, clips } = data;
  const dateLabel = formatFestivalDateRange(festival.start_date, festival.end_date);
  const locationLabel = [festival.venue_name, festival.city_line].filter(Boolean).join(' · ');
  const markEvent = festivalPageToJamBaseEvent(festival);

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="relative bg-gradient-to-b from-momentum-ember/25 to-black border-b border-momentum-ember/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            <img
              src={displayMediaUrl(festival.image_url || FALLBACK_FEST_IMAGE)}
              alt={festival.name}
              referrerPolicy="no-referrer"
              decoding="async"
              className="w-48 h-48 rounded-xl object-cover border-4 border-momentum-flare/40 shadow-xl shadow-momentum-ember/25"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-momentum-flare mb-2">
                Festival
              </p>
              <h1 className="fb-hero-title mb-4">{festival.name}</h1>
              {dateLabel ? (
                <div className="flex items-center space-x-2 mb-2 text-gray-300">
                  <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
                  <p className="text-lg">{dateLabel}</p>
                </div>
              ) : null}
              {locationLabel ? (
                <div className="flex items-center space-x-2 mb-4 text-gray-300">
                  <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                  {festival.venue_name ? (
                    <button
                      type="button"
                      onClick={() => navigate(venuePath(festival.venue_name))}
                      className="text-lg text-left hover:text-momentum-flare transition-colors"
                    >
                      {locationLabel}
                    </button>
                  ) : (
                    <p className="text-lg">{locationLabel}</p>
                  )}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 max-w-xl">
                {markEvent ? (
                  <ShowMarkButtons event={markEvent} size="hero" className="w-full" />
                ) : null}
                <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
                {festival.ticket_url ? (
                  <EventTicketActions
                    ticketUrl={festival.ticket_url}
                    eventTitle={festival.name}
                    className="flex-1"
                  />
                ) : null}
                {festival.website_url ? (
                  <a
                    href={festival.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-all"
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    Festival website
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-80" />
                  </a>
                ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={PAGE_BLOCK_CLASS}>
          <SectionHeading
            title="Lineup"
            subtitle={
              artists.length > 0
                ? 'Artists playing this festival'
                : 'Lineup will show here when JamBase lists the artists'
            }
            badge={
              artists.length > 0 ? (
                <span className="px-3 py-1 bg-momentum-flare/20 text-momentum-flare text-sm rounded-full font-medium">
                  {artists.length} artists
                </span>
              ) : null
            }
          />
          {artists.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artists.map((artist) => (
                <button
                  key={artist.jambase_id ?? artist.name}
                  type="button"
                  onClick={() => navigate(artistPath(artist.name))}
                  className="text-left glass-panel border border-momentum-rose/25 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-colors group"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={displayMediaUrl(artist.image_url?.trim() || FALLBACK_ARTIST_IMAGE)}
                      alt={artist.name}
                      referrerPolicy="no-referrer"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      {artist.is_headliner ? (
                        <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-momentum-flare/90 text-[10px] font-semibold uppercase tracking-wide">
                          Headliner
                        </span>
                      ) : null}
                      <div className="text-white font-semibold text-sm truncate">{artist.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 glass-panel border border-momentum-flare/20 rounded-xl">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Lineup not listed yet</p>
            </div>
          )}
        </div>

        <div className={PAGE_BLOCK_CLASS}>
          <SectionHeading
            title="Live Moments"
            subtitle="Fan-captured moments from this festival"
            badge={
              <span className="px-3 py-1 bg-momentum-flare/20 text-momentum-flare text-sm rounded-full font-medium">
                {clips.length} clips
              </span>
            }
          />
          {clips.length > 0 ? (
            <div className={HOME_FEED_SECTION_CLASS}>
              <ClipFeedCarousel
                clips={clips}
                className={PAGE_CAROUSEL_BLEED}
                ariaLabel={`Clips from ${festival.name}`}
                onOpenClip={(clip, visible) => {
                  setSelectedClip(clip);
                  setModalFeed(visible);
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12 glass-panel border border-momentum-flare/20 rounded-xl">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Nothing here yet</p>
              <p className="text-gray-500 mt-2">Drop the first clip from {festival.name}!</p>
            </div>
          )}
        </div>

        {data.jambase_attribution ? (
          <p className="mt-4 text-center text-xs text-gray-500">
            <a
              href="https://www.jambase.com"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-gray-400 hover:text-momentum-flare/90 underline"
            >
              Festival listings powered by JamBase
            </a>
          </p>
        ) : null}
      </div>

      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => {
            setSelectedClip(null);
            setModalFeed(null);
          }}
          feedNavigation={
            modalFeed && modalFeed.length > 1
              ? { clips: modalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      )}
    </div>
  );
}
