import { Calendar, Music, Video } from 'lucide-react';
import { useNavigate } from 'react-router';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import {
  EVENT_CAROUSEL_CARD_CLASS,
  EVENT_CAROUSEL_IMAGE_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';
import { eventClipsPath } from '@/shared/app-paths';
import { pastShowSummaryToJamBaseEvent } from '@/shared/show-marks';
import ShowMarkButtons from '@/react-app/components/ShowMarkButtons';
import ClipPosterImage from '@/react-app/components/ClipPosterImage';

export interface PastShowSummary {
  event_title: string;
  artist_name: string;
  show_date: string;
  venue_name?: string | null;
  venue_location?: string | null;
  jambase_event_id?: string | null;
  jambase_venue_id?: string | null;
  jambase_artist_id?: string | null;
  clip_count: number;
  average_show_rating?: number;
  thumbnail_url: string | null;
}

interface PastShowsCarouselProps {
  shows: PastShowSummary[];
  variant: 'artist' | 'venue';
}

function formatShowDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PastShowsCarousel({ shows, variant }: PastShowsCarouselProps) {
  const navigate = useNavigate();

  return (
    <HorizontalClipCarousel
      stretchItems
      ariaLabel={variant === 'artist' ? 'Past shows for this artist' : 'Past shows at this venue'}
      className={PAGE_CAROUSEL_BLEED}
    >
      {shows.map((show) => {
        const secondaryLine =
          variant === 'artist'
            ? show.venue_name?.trim() || null
            : show.artist_name?.trim() || null;
        const markEvent = pastShowSummaryToJamBaseEvent(show);

        return (
          <HorizontalClipCarouselItem key={show.event_title} mobilePeek="event">
            <article className={`${EVENT_CAROUSEL_CARD_CLASS} glass-panel border border-momentum-rose/20 rounded-xl overflow-hidden`}>
              <div className={`${EVENT_CAROUSEL_IMAGE_CLASS} group`}>
                <ClipPosterImage
                  clip={{ thumbnail_url: show.thumbnail_url }}
                  alt={show.event_title}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Video className="w-3.5 h-3.5 text-white" />
                  <span className="text-white text-xs font-medium">
                    {show.clip_count} clip{show.clip_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-white font-bold text-base leading-snug line-clamp-2 mb-2">
                  {show.event_title}
                </h3>
                <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-1">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-momentum-flare" />
                  <span>{formatShowDate(show.show_date)}</span>
                </div>
                {secondaryLine ? (
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-3 min-h-[1rem]">
                    {variant === 'artist' ? (
                      <Music className="w-3 h-3 shrink-0" />
                    ) : (
                      <Music className="w-3 h-3 shrink-0 text-momentum-rose/80" />
                    )}
                    <span className="line-clamp-1">{secondaryLine}</span>
                  </div>
                ) : (
                  <div className="mb-3 min-h-[1rem]" />
                )}
                <div className="mt-auto space-y-2">
                  {markEvent ? (
                    <ShowMarkButtons event={markEvent} statusOverride="attended" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate(eventClipsPath(show.event_title))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-momentum-flare to-momentum-rose text-white text-sm font-semibold hover:scale-[1.02] transition-transform"
                  >
                    View Show Clips
                  </button>
                </div>
              </div>
            </article>
          </HorizontalClipCarouselItem>
        );
      })}
    </HorizontalClipCarousel>
  );
}
