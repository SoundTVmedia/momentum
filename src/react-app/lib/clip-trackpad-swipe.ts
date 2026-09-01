export const TRACKPAD_SWIPE_MIN = 48
export const TRACKPAD_SWIPE_LOCK_MS = 420

export function isClipSwipeIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, [role="button"], [data-no-clip-swipe], .overflow-y-auto',
    ),
  )
}

export function isClipSwipeSurface(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-clip-swipe-surface]'))
}

export function wheelDeltaPx(event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>): {
  dx: number
  dy: number
} {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1
  return { dx: event.deltaX * scale, dy: event.deltaY * scale }
}

/** Discrete mouse-wheel notches are large; two-finger trackpad ticks stay small. */
export function isLikelyTrackpadWheel(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey'>,
): boolean {
  if (event.ctrlKey) return false
  if (event.deltaMode !== 0) return false
  return Math.abs(event.deltaX) <= 80 && Math.abs(event.deltaY) <= 80
}

/** Two-finger swipe left / scroll right → next. Swipe up / scroll down → tickets. */
export function trackpadSwipeIntent(
  accX: number,
  accY: number,
  minPx = TRACKPAD_SWIPE_MIN,
): 'next' | 'prev' | 'up' | null {
  const ax = Math.abs(accX)
  const ay = Math.abs(accY)
  if (ax < minPx && ay < minPx) return null
  if (ax > ay) return accX > 0 ? 'next' : 'prev'
  return accY > 0 ? 'up' : null
}
