import { useCallback, useEffect, useRef, type RefObject } from 'react';

const SWIPE_MIN_PX = 40;
const VERTICAL_INTENT_PX = 14;
const SWIPE_LOCK_MS = 400;

type UseVerticalSwipeUpOptions = {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onSwipeUp: () => void;
};

/**
 * Detects a vertical swipe up (finger moves up). Ignored when horizontal motion dominates.
 */
export function useVerticalSwipeUp({
  enabled,
  containerRef,
  onSwipeUp,
}: UseVerticalSwipeUpOptions) {
  const lockRef = useRef(false);
  const onSwipeUpRef = useRef(onSwipeUp);
  onSwipeUpRef.current = onSwipeUp;

  const runSwipe = useCallback((fn: () => void) => {
    if (lockRef.current) return;
    lockRef.current = true;
    fn();
    window.setTimeout(() => {
      lockRef.current = false;
    }, SWIPE_LOCK_MS);
  }, []);

  const evaluateSwipe = useCallback(
    (dx: number, dy: number) => {
      if (dy < SWIPE_MIN_PX) return;
      if (Math.abs(dy) <= Math.abs(dx)) return;
      runSwipe(() => onSwipeUpRef.current());
    },
    [runSwipe],
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
      if (Math.abs(dy) > VERTICAL_INTENT_PX && Math.abs(dy) > Math.abs(dx)) {
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
  }, [enabled, containerRef, evaluateSwipe]);
}
