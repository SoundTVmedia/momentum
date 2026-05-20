import { useCallback, useRef } from 'react';

const SWIPE_MIN_PX = 40;
const NAV_LOCK_MS = 400;

type UseHorizontalFeedSwipeOptions = {
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/** One horizontal swipe (left = next, right = prev) with debounce so a single gesture advances once. */
export function useHorizontalFeedSwipe({
  enabled,
  onPrev,
  onNext,
}: UseHorizontalFeedSwipeOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const navLockRef = useRef(false);

  const runNav = useCallback((fn: () => void) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    fn();
    window.setTimeout(() => {
      navLockRef.current = false;
    }, NAV_LOCK_MS);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const t = e.targetTouches[0];
      touchStartX.current = t.clientX;
      touchStartY.current = t.clientY;
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || touchStartX.current == null || touchStartY.current == null) {
        return;
      }
      const t = e.changedTouches[0];
      const dx = touchStartX.current - t.clientX;
      const dy = touchStartY.current - t.clientY;
      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.05) return;

      if (dx > 0) runNav(onNext);
      else runNav(onPrev);
    },
    [enabled, onNext, onPrev, runNav],
  );

  return { onTouchStart, onTouchEnd };
}
