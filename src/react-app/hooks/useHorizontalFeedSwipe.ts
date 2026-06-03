import { useCallback, useEffect, useRef, type RefObject } from 'react';

const SWIPE_MIN_PX = 40;
const HORIZONTAL_INTENT_PX = 14;
const NAV_LOCK_MS = 400;

type UseHorizontalFeedSwipeOptions = {
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Share a container with other gesture hooks (e.g. vertical swipe up). */
  containerRef?: RefObject<HTMLElement | null>;
};

/**
 * One horizontal swipe (left = next, right = prev) with debounce so a single gesture advances once.
 * Prefer `containerRef` on a full-screen mobile wrapper; optional React touch handlers for smaller targets.
 */
export function useHorizontalFeedSwipe({
  enabled,
  onPrev,
  onNext,
  containerRef: externalContainerRef,
}: UseHorizontalFeedSwipeOptions) {
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalContainerRef ?? internalContainerRef;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const navLockRef = useRef(false);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);

  onPrevRef.current = onPrev;
  onNextRef.current = onNext;

  const runNav = useCallback((fn: () => void) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    fn();
    window.setTimeout(() => {
      navLockRef.current = false;
    }, NAV_LOCK_MS);
  }, []);

  const evaluateSwipe = useCallback(
    (dx: number, dy: number) => {
      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      if (dx > 0) runNav(() => onNextRef.current());
      else runNav(() => onPrevRef.current());
    },
    [runNav],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > HORIZONTAL_INTENT_PX && Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = startX - t.clientX;
      const dy = startY - t.clientY;
      evaluateSwipe(dx, dy);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, evaluateSwipe]);

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
      evaluateSwipe(dx, dy);
    },
    [enabled, evaluateSwipe],
  );

  return { containerRef, onTouchStart, onTouchEnd };
}
