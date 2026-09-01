import { useEffect, useRef, type RefObject } from 'react'
import {
  isClipSwipeIgnoredTarget,
  isClipSwipeSurface,
  isLikelyTrackpadWheel,
  TRACKPAD_SWIPE_LOCK_MS,
  TRACKPAD_SWIPE_MIN,
  trackpadSwipeIntent,
  wheelDeltaPx,
} from '@/react-app/lib/clip-trackpad-swipe'

type UseTrackpadFeedSwipeOptions = {
  enabled: boolean
  containerRef: RefObject<HTMLElement | null>
  onPrev?: () => void
  onNext?: () => void
  onSwipeUp?: () => void
  horizontalEnabled?: boolean
  verticalEnabled?: boolean
}

/**
 * Two-finger trackpad / mouse-wheel flicks on the clip player:
 * horizontal → next/prev clip, swipe up → tickets.
 */
export function useTrackpadFeedSwipe({
  enabled,
  containerRef,
  onPrev,
  onNext,
  onSwipeUp,
  horizontalEnabled = true,
  verticalEnabled = true,
}: UseTrackpadFeedSwipeOptions) {
  const onPrevRef = useRef(onPrev)
  const onNextRef = useRef(onNext)
  const onSwipeUpRef = useRef(onSwipeUp)
  onPrevRef.current = onPrev
  onNextRef.current = onNext
  onSwipeUpRef.current = onSwipeUp

  useEffect(() => {
    const el = containerRef.current
    if (!enabled || !el) return

    let accX = 0
    let accY = 0
    let lock = false
    let idleTimer = 0

    const resetAcc = () => {
      accX = 0
      accY = 0
    }

    const onWheel = (event: WheelEvent) => {
      if (!isLikelyTrackpadWheel(event)) return
      if (!isClipSwipeSurface(event.target)) return
      if (isClipSwipeIgnoredTarget(event.target)) return

      const { dx, dy } = wheelDeltaPx(event)
      accX += dx
      accY += dy

      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(resetAcc, 160)

      const intent = trackpadSwipeIntent(accX, accY, TRACKPAD_SWIPE_MIN)
      if (!intent) {
        if (Math.abs(accX) > 8 || Math.abs(accY) > 8) {
          event.preventDefault()
        }
        return
      }

      if (intent === 'next' && !horizontalEnabled) {
        resetAcc()
        return
      }
      if (intent === 'prev' && !horizontalEnabled) {
        resetAcc()
        return
      }
      if (intent === 'up' && !verticalEnabled) {
        resetAcc()
        return
      }

      event.preventDefault()
      if (lock) return
      lock = true
      resetAcc()
      window.setTimeout(() => {
        lock = false
      }, TRACKPAD_SWIPE_LOCK_MS)

      if (intent === 'next') onNextRef.current?.()
      else if (intent === 'prev') onPrevRef.current?.()
      else onSwipeUpRef.current?.()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.clearTimeout(idleTimer)
      el.removeEventListener('wheel', onWheel)
    }
  }, [enabled, containerRef, horizontalEnabled, verticalEnabled])
}
