import { useNavigate } from 'react-router';
import { Music } from 'lucide-react';
import { artistPath } from '@/shared/app-paths';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

export type DiscoverArtist = {
  name: string;
  image_url: string | null;
  clip_count: number;
  jambase_id?: string | null;
};

const FALLBACK_ARTIST_IMAGE =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

type DiscoverArtistCarouselProps = {
  artists: DiscoverArtist[];
  className?: string;
};

export default function DiscoverArtistCarousel({
  artists,
  className = PAGE_CAROUSEL_BLEED,
}: DiscoverArtistCarouselProps) {
  const navigate = useNavigate();

  if (artists.length === 0) return null;

  return (
    <HorizontalClipCarousel ariaLabel="Trending artists" className={className}>
      {artists.map((artist) => (
        <HorizontalClipCarouselItem
          key={artist.jambase_id ?? artist.name}
          className="md:w-44 lg:w-48"
        >
          <button
            type="button"
            onClick={() => navigate(artistPath(artist.name))}
            className="w-full h-full text-left glass-panel border border-momentum-rose/25 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-colors group"
          >
            <div className="relative aspect-square overflow-hidden">
              <img
                src={artist.image_url?.trim() || FALLBACK_ARTIST_IMAGE}
                alt={artist.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-1.5 text-white font-semibold text-sm truncate">
                  <Music className="w-4 h-4 text-momentum-rose/80 shrink-0" aria-hidden />
                  <span className="truncate">{artist.name}</span>
                </div>
                <p className="text-gray-300 text-xs mt-0.5">
                  {artist.clip_count} clip{artist.clip_count === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </button>
        </HorizontalClipCarouselItem>
      ))}
    </HorizontalClipCarousel>
  );
}
