import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClipWithUser } from '@/shared/types';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import { ClipGridTileSkeleton } from '@/react-app/components/LoadingSkeleton';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';

type ClipsInfiniteGridProps = {
  clips: ClipWithUser[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  emptyMessage?: string;
};

export default function ClipsInfiniteGrid({
  clips,
  loading,
  hasMore,
  onLoadMore,
  emptyMessage = 'No clips to show yet.',
}: ClipsInfiniteGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || clips.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '240px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [clips.length, hasMore, loading, onLoadMore]);

  if (!loading && clips.length === 0) {
    return <p className="text-center text-gray-400 py-16">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {clips.map((clip, index) => (
          <ClipFeedGridTile
            key={clipListItemKey(clip, index)}
            clip={clip}
            onOpenClip={setSelectedClip}
            neighborClips={{
              prev: clips[index - 1],
              next: clips[index + 1],
            }}
          />
        ))}
        {loading && clips.length === 0
          ? Array.from({ length: 8 }).map((_, i) => <ClipGridTileSkeleton key={`sk-${i}`} />)
          : null}
      </div>

      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      {loading && clips.length > 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
        </div>
      ) : null}

      {!loading && !hasMore && clips.length > 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">You&apos;ve seen all clips</p>
      ) : null}

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
