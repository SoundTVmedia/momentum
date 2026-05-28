import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';

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
  if (clips.length === 0) return null;

  return (
    <HorizontalClipCarousel
      key={carouselKey}
      ariaLabel={ariaLabel}
      className={className}
      stretchItems
      filmstrip
    >
      {clips.map((clip, index) => (
        <HorizontalClipCarouselItem key={clipListItemKey(clip, index)}>
          <ClipFeedGridTile
            clip={clip}
            onOpenClip={onOpenClip}
            neighborClips={{
              prev: clips[index - 1],
              next: clips[index + 1],
            }}
          />
        </HorizontalClipCarouselItem>
      ))}
    </HorizontalClipCarousel>
  );
}
