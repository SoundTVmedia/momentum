import { useEffect, type RefObject } from 'react';

type UseCarouselInfiniteLoadOptions = {
  scrollRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  itemCount: number;
};

/** Observe a sentinel inside a horizontal carousel scrollport to trigger pagination. */
export function useCarouselInfiniteLoad({
  scrollRef,
  sentinelRef,
  enabled,
  hasMore,
  loading,
  onLoadMore,
  itemCount,
}: UseCarouselInfiniteLoadOptions) {
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!enabled || !root || !target || itemCount === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { root, threshold: 0.1, rootMargin: '160px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [scrollRef, sentinelRef, enabled, hasMore, loading, onLoadMore, itemCount]);
}
