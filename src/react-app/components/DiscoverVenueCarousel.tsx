import { useNavigate } from 'react-router';
import { MapPin } from 'lucide-react';
import { venuePath } from '@/shared/app-paths';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { MOBILE_CAROUSEL_ITEM_PEEK_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

export type DiscoverVenue = {
  name: string;
  image_url: string | null;
  location: string | null;
  clip_count?: number;
  jambase_id?: string | null;
};

const FALLBACK_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop';

type DiscoverVenueCarouselProps = {
  venues: DiscoverVenue[];
  className?: string;
};

export default function DiscoverVenueCarousel({
  venues,
  className = PAGE_CAROUSEL_BLEED,
}: DiscoverVenueCarouselProps) {
  const navigate = useNavigate();

  if (venues.length === 0) return null;

  return (
    <HorizontalClipCarousel ariaLabel="Venues" className={className} filmstrip={false}>
      {venues.map((venue) => (
        <HorizontalClipCarouselItem
          key={venue.jambase_id ?? venue.name}
          className={`md:w-44 lg:w-48 ${MOBILE_CAROUSEL_ITEM_PEEK_CLASS}`}
        >
          <button
            type="button"
            onClick={() => navigate(venuePath(venue.name))}
            className="w-full h-full text-left glass-panel border border-momentum-flare/25 rounded-xl overflow-hidden hover:border-momentum-flare/50 transition-colors group"
          >
            <div className="relative aspect-square overflow-hidden">
              <img
                src={venue.image_url?.trim() || FALLBACK_VENUE_IMAGE}
                alt={venue.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-1.5 text-white font-semibold text-sm truncate">
                  <MapPin className="w-4 h-4 text-momentum-flare/80 shrink-0" aria-hidden />
                  <span className="truncate">{venue.name}</span>
                </div>
                {venue.location ? (
                  <p className="text-gray-300 text-xs mt-0.5 truncate">{venue.location}</p>
                ) : null}
                {venue.clip_count != null && venue.clip_count > 0 ? (
                  <p className="text-gray-300 text-xs mt-0.5">
                    {venue.clip_count} clip{venue.clip_count === 1 ? '' : 's'}
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        </HorizontalClipCarouselItem>
      ))}
    </HorizontalClipCarousel>
  );
}

export function discoverVenueFromJamBase(v: Record<string, unknown>): DiscoverVenue {
  const name = typeof v.name === 'string' ? v.name : 'Venue';
  const image = typeof v.image === 'string' ? v.image : null;
  const addr = v.address as Record<string, unknown> | undefined;
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const locality =
    typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
  const regionName =
    typeof region?.alternateName === 'string'
      ? region.alternateName
      : typeof region?.name === 'string'
        ? String(region.name)
        : '';
  const location = [locality, regionName].filter(Boolean).join(', ') || null;

  return {
    name,
    image_url: image,
    location,
    jambase_id: typeof v.identifier === 'string' ? v.identifier : null,
  };
}
