import { useEffect } from 'react'
import { isNativeApp } from '@/react-app/lib/native-bridge'
import { stabilizeWindowTopInset } from '@/react-app/lib/scroll-window'

/**
 * After scroll / overscroll, iOS can leave a residual top inset. Snap back when
 * the user lands at the top so chrome spacing matches cold launch everywhere.
 */
export default function AppTopInsetStabilizer() {
  useEffect(() => {
    if (!isNativeApp()) return

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        stabilizeWindowTopInset()
      })
    }

    const onScrollEnd = () => schedule()
    window.addEventListener('scrollend', onScrollEnd, { passive: true })
    window.addEventListener('touchend', schedule, { passive: true })
    window.addEventListener('touchcancel', schedule, { passive: true })
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true })
    window.visualViewport?.addEventListener('resize', schedule, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scrollend', onScrollEnd)
      window.removeEventListener('touchend', schedule)
      window.removeEventListener('touchcancel', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [])

  return null
}
