import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { filterViewerFeedClips } from '@/react-app/lib/clipPlaybackFailure';

export type ClipFeedCarouselProps = {
  clips: ClipWithUser[];
  onOpenClip: (clip: ClipWithUser) => void;
  ariaLabel?: string;
  className?: string;
  carouselKey?: string;
};

export default function ClipFeedCarousel({
  clips,
  onOpenClip,
  ariaLabel = 'Clips',
  className = PAGE_CAROUSEL_BLEED,
  carouselKey,
}: ClipFeedCarouselProps) {
  const visible = filterViewerFeedClips(clips);
  if (visible.length === 0) return null;

  return (
    <HorizontalClipCarousel
      key={carouselKey}
      ariaLabel={ariaLabel}
      className={className}
      stretchItems
    >
      {visible.map((clip, index) => (
        <HorizontalClipCarouselItem key={clipListItemKey(clip, index)}>
          <ClipFeedGridTile
            clip={clip}
            onOpenClip={onOpenClip}
            neighborClips={{
              prev: visible[index - 1],
              next: visible[index + 1],
            }}
          />
        </HorizontalClipCarouselItem>
      ))}
    </HorizontalClipCarousel>
  );
}
