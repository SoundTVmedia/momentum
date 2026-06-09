import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import CarouselFeedFooter from '@/react-app/components/CarouselFeedFooter';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { useClips } from '@/react-app/hooks/useClips';
import { useCarouselInfiniteLoad } from '@/react-app/hooks/useCarouselInfiniteLoad';
import {
  HOME_FEED_CAROUSEL_BLEED,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

type PrePostClipsCarouselProps = {
  /** Friends you follow, or your own pre/post moments on profile. */
  scope: 'friends' | 'mine';
  emptyMessage: string;
  ariaLabel: string;
  edgeBleed?: boolean;
  edgeBleedScope?: 'home' | 'page';
  viewAllHref?: string;
  viewAllLabel?: string;
  enableInfiniteScroll?: boolean;
};

export default function PrePostClipsCarousel({
  scope,
  emptyMessage,
  ariaLabel,
  edgeBleed = false,
  edgeBleedScope = 'page',
  viewAllHref,
  viewAllLabel = 'View all',
  enableInfiniteScroll = false,
}: PrePostClipsCarouselProps) {
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);

  const { clips, loading, hasMore, loadMore } = useClips({
    feedType: 'latest',
    feedScope: scope === 'friends' ? 'friends' : 'main',
    mine: scope === 'mine',
    contentFeed: scope === 'mine' ? 'pre_post' : undefined,
    limit: 12,
  });

  useCarouselInfiniteLoad({
    scrollRef: carouselScrollRef,
    sentinelRef: loadMoreSentinelRef,
    enabled: enableInfiniteScroll && clips.length > 0,
    hasMore,
    loading,
    onLoadMore: loadMore,
    itemCount: clips.length,
  });

  const carouselClass = edgeBleed
    ? edgeBleedScope === 'home'
      ? HOME_FEED_CAROUSEL_BLEED
      : PAGE_CAROUSEL_BLEED
    : '-mx-5 px-5 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:pt-1 md:pb-2';

  if (loading && clips.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (clips.length === 0) {
    return <p className="text-gray-400 text-sm py-4">{emptyMessage}</p>;
  }

  return (
    <>
      <HorizontalClipCarousel
        ref={enableInfiniteScroll ? carouselScrollRef : undefined}
        ariaLabel={ariaLabel}
        stretchItems
        className={carouselClass}
        onReachEnd={() => {
          if (enableInfiniteScroll && hasMore && !loading) loadMore();
        }}
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
        {enableInfiniteScroll && hasMore ? (
          <div
            ref={loadMoreSentinelRef}
            className="flex-shrink-0 w-px h-px opacity-0 snap-none"
            aria-hidden
          />
        ) : null}
      </HorizontalClipCarousel>

      <CarouselFeedFooter
        loading={loading && clips.length > 0}
        hasMore={hasMore}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
        showEndMessage={!viewAllHref}
      />

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          feedNavigation={
            clips.length > 1 ? { clips, onChangeClip: setSelectedClip } : null
          }
        />
      ) : null}
    </>
  );
}
