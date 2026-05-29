import { useState } from 'react';
import { Flame } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useClips } from '@/react-app/hooks/useClips';
import type { ClipWithUser } from '@/shared/types';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import ClipModal from '@/react-app/components/ClipModal';
import { ClipGridTileSkeleton } from '@/react-app/components/LoadingSkeleton';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

export default function TrendingFilmstrip() {
  const navigate = useNavigate();
  const { clips, loading } = useClips({ feedType: 'trending', limit: 12 });
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [modalFeed, setModalFeed] = useState<ClipWithUser[] | null>(null);

  const openClip = (clip: ClipWithUser) => {
    setSelectedClip(clip);
    setModalFeed(clips.length > 1 ? clips : null);
  };

  return (
    <section className="relative pt-4 pb-8 sm:pb-10 md:pb-12">
      <div className="absolute inset-0 bg-gradient-to-r from-momentum-ember/5 via-momentum-flare/5 to-momentum-rose/8" />
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-momentum-ember/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-momentum-flare/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="relative">
              <Flame className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-momentum-ember animate-pulse" />
              <div className="absolute inset-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-momentum-ember/25 rounded-full blur-lg animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-rose bg-clip-text text-transparent">
              Trending Moments
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-momentum-flare hover:text-momentum-flare/90 text-xs sm:text-sm font-medium transition-colors"
          >
            View All
          </button>
        </div>

        {loading && clips.length === 0 ? (
          <HorizontalClipCarousel
            ariaLabel="Trending clips loading"
            className={PAGE_CAROUSEL_BLEED}
            stretchItems
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <HorizontalClipCarouselItem key={`sk-${i}`}>
                <ClipGridTileSkeleton />
              </HorizontalClipCarouselItem>
            ))}
          </HorizontalClipCarousel>
        ) : clips.length > 0 ? (
          <ClipFeedCarousel
            clips={clips}
            onOpenClip={openClip}
            ariaLabel="Trending clips"
            className={PAGE_CAROUSEL_BLEED}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">No trending clips right now. Be the first to post!</p>
          </div>
        )}
      </div>

      {selectedClip ? (
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
      ) : null}
    </section>
  );
}
