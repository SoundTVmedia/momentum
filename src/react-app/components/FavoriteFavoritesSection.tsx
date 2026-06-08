import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import FeedFilters from '@/react-app/components/FeedFilters';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import SectionHeading from '@/react-app/components/SectionHeading';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import {
  FAVORITE_FEED_FILTER_OPTIONS,
  getFavoriteFeedFilterMeta,
  type FavoriteFeedFilterValue,
} from '@/react-app/lib/favoriteFeedFilterMeta';
import {
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

const CLIPS_LIMIT = 16;

export default function FavoriteFavoritesSection() {
  const { user, isPending } = useAuth();
  const [filter, setFilter] = useState<FavoriteFeedFilterValue>('latest');
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [hasFavoriteArtists, setHasFavoriteArtists] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);

  const { label, description } = getFavoriteFeedFilterMeta(filter);

  const fetchClips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/discover/favorite-artist-feed?events_limit=0&clips_limit=${CLIPS_LIMIT}&clips_offset=0`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('favorite-artist-feed');
      const data = (await res.json()) as {
        hasFavoriteArtists?: boolean;
        clips?: ClipWithUser[];
      };
      setHasFavoriteArtists(Boolean(data.hasFavoriteArtists));
      setClips(data.clips ?? []);
    } catch {
      setHasFavoriteArtists(false);
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPending || !user) return;
    if (filter !== 'latest') return;
    void fetchClips();
  }, [user, isPending, filter, fetchClips]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (filter === 'latest') void fetchClips();
    };
    window.addEventListener('favorite-artists-changed', refresh);
    return () => window.removeEventListener('favorite-artists-changed', refresh);
  }, [user, filter, fetchClips]);

  if (!user || isPending) return null;

  return (
    <div className={HOME_FEED_SECTION_CLASS}>
      <div className="mb-5 md:mb-5">
        <SectionHeading title={label} subtitle={description} size="section" />
        <div className="mt-3 md:mt-4">
          <FeedFilters
            options={FAVORITE_FEED_FILTER_OPTIONS}
            currentFilter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </div>

      {filter === 'latest' ? (
        loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : !hasFavoriteArtists ? (
          <p className="text-gray-400 text-sm py-4">
            Add favorite artists to see their latest clips here.
          </p>
        ) : clips.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">
            No clips yet from your favorite artists — check back after the next show.
          </p>
        ) : (
          <HorizontalClipCarousel
            ariaLabel="Latest clips from your favorite artists"
            stretchItems
            className={PAGE_CAROUSEL_BLEED}
          >
            {clips.map((clip, index) => (
              <HorizontalClipCarouselItem key={clipListItemKey(clip, index)}>
                <ClipFeedGridTile
                  clip={clip}
                  onOpenClip={setSelectedClip}
                  neighborClips={{
                    prev: clips[index - 1],
                    next: clips[index + 1],
                  }}
                />
              </HorizontalClipCarouselItem>
            ))}
          </HorizontalClipCarousel>
        )
      ) : (
        <PersonalizedConcerts
          carouselBleedScope="page"
          mode="favorite-artists"
          hideHeader
        />
      )}

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          feedNavigation={
            clips.length > 1 ? { clips, onChangeClip: setSelectedClip } : null
          }
        />
      ) : null}
    </div>
  );
}
