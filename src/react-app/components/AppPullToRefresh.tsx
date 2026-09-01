import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { dispatchAppPullRefresh } from '@/react-app/lib/app-pull-refresh'
import { isNativeApp } from '@/react-app/lib/native-bridge'

const PULL_RESISTANCE = 0.38
const PULL_THRESHOLD = 72
const PULL_MAX = 128
const HOLD_PX = 56
const MIN_SPINNER_MS = 420
const REFRESH_TIMEOUT_MS = 8000

function shouldIgnorePullTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true
  if (target.closest('[data-app-ptr="off"]')) return true
  if (target.closest('.clip-player-lock-scale, .glass-modal-overlay')) return true
  return false
}

function pullBlocked(): boolean {
  if (document.documentElement.classList.contains('native-quick-capture-open')) return true
  if (document.querySelector('.clip-player-lock-scale')) return true
  if (document.querySelector('ion-modal.show-modal')) return true
  return false
}

async function hapticLight() {
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* web / unsupported */
  }
}

type AppPullToRefreshProps = {
  children: ReactNode
}

export default function AppPullToRefresh({ children }: AppPullToRefreshProps) {
  const { pathname } = useLocation()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)
  const armedRef = useRef(false)
  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const trackingRef = useRef(false)
  const hapticFiredRef = useRef(false)

  const enabled = isNativeApp() && pathname !== '/auth' && !pathname.startsWith('/auth/')

  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add('app-ptr-enabled')
    return () => document.documentElement.classList.remove('app-ptr-enabled')
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const setPullPx = (next: number) => {
      pullRef.current = next
      setPull(next)
    }

    const finishRefresh = async () => {
      const tasks: Promise<unknown>[] = []
      dispatchAppPullRefresh((task) => {
        tasks.push(task)
      })
      const all = Promise.allSettled(tasks)
      const timeout = new Promise((resolve) => {
        window.setTimeout(resolve, REFRESH_TIMEOUT_MS)
      })
      const floor = new Promise((resolve) => {
        window.setTimeout(resolve, MIN_SPINNER_MS)
      })
      await Promise.all([Promise.race([all, timeout]), floor])
      refreshingRef.current = false
      setRefreshing(false)
      setPullPx(0)
    }

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || pullBlocked()) return
      if (event.touches.length !== 1) return
      if (window.scrollY > 2 || document.documentElement.scrollTop > 2) return
      if (shouldIgnorePullTarget(event.target)) return
      trackingRef.current = true
      armedRef.current = false
      hapticFiredRef.current = false
      startYRef.current = event.touches[0].clientY
      startXRef.current = event.touches[0].clientX
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!trackingRef.current || refreshingRef.current) return
      if (event.touches.length !== 1) return
      const y = event.touches[0].clientY
      const x = event.touches[0].clientX
      const dy = y - startYRef.current
      const dx = x - startXRef.current

      if (!armedRef.current) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          trackingRef.current = false
          setPullPx(0)
          return
        }
        if (dy > 8) armedRef.current = true
      }

      if (!armedRef.current) return
      if (dy <= 0) {
        setPullPx(0)
        return
      }

      event.preventDefault()
      const next = Math.min(dy * PULL_RESISTANCE, PULL_MAX)
      if (next >= PULL_THRESHOLD && !hapticFiredRef.current) {
        hapticFiredRef.current = true
        void hapticLight()
      }
      setPullPx(next)
    }

    const onTouchEnd = () => {
      if (!trackingRef.current) return
      trackingRef.current = false
      armedRef.current = false
      if (refreshingRef.current) return
      if (pullRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullPx(HOLD_PX)
        void finishRefresh()
        return
      }
      setPullPx(0)
    }

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('touchend', onTouchEnd, true)
      document.removeEventListener('touchcancel', onTouchEnd, true)
    }
  }, [enabled])

  if (!enabled) return children

  const visible = pull > 8 || refreshing
  const spinnerOpacity = refreshing ? 1 : Math.min(1, pull / PULL_THRESHOLD)
  const spinnerRotate = refreshing ? undefined : pull * 3

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
        style={{ top: 'max(10px, env(safe-area-inset-top, 0px))' }}
        aria-hidden={!visible}
      >
        <Loader2
          className={`h-7 w-7 text-white ${refreshing ? 'animate-spin' : ''}`}
          style={{
            opacity: visible ? spinnerOpacity : 0,
            transform: spinnerRotate != null ? `rotate(${spinnerRotate}deg)` : undefined,
          }}
          aria-hidden
        />
      </div>
      <div
        className="app-ptr-sheet"
        style={{
          transform: pull > 0 ? `translate3d(0, ${pull}px, 0)` : undefined,
        }}
      >
        {children}
      </div>
    </>
  )
}
