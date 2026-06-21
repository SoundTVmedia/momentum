import { useEffect, useState } from 'react';

const MOBILE_MAX_EDGE_PX = 767;

/** Matches Tailwind `md` breakpoint using the shorter viewport edge (landscape-safe). */
export function isMobileViewportSize(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  return Math.min(width, height) <= MOBILE_MAX_EDGE_PX;
}

/** Matches Tailwind `md` on phones — including landscape where width exceeds 767px. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia(`(max-width: ${MOBILE_MAX_EDGE_PX}px)`).matches) return true;
  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  return isMobileViewportSize(w, h);
}

export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => isMobileViewport());

  useEffect(() => {
    const update = () => setIsMobile(isMobileViewport());
    update();
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_EDGE_PX}px)`);
    mq.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    screen.orientation?.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      screen.orientation?.removeEventListener('change', update);
    };
  }, []);

  return isMobile;
}
