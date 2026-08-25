import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import {
  APP_SPLASH_ELEMENT_ID,
  shouldSkipAppSplash,
  splashHideDelayMs,
} from '@/react-app/lib/app-splash';

function hideSplash(el: HTMLElement, immediate: boolean) {
  if (el.dataset.splashHidden === '1') return;
  el.dataset.splashHidden = '1';

  if (immediate) {
    el.remove();
    return;
  }

  const finish = () => {
    el.remove();
  };

  el.classList.add('app-splash--done');
  el.addEventListener('transitionend', finish, { once: true });
  window.setTimeout(finish, 400);
}

/**
 * Keeps the HTML launch splash visible for at least 3s (and until the first app
 * frame has painted), then fades it out so the Powered By lockup can be read.
 */
export default function AppSplashController() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const el = document.getElementById(APP_SPLASH_ELEMENT_ID);
    if (!el) return;

    if (shouldSkipAppSplash(pathname)) {
      hideSplash(el, true);
      return;
    }

    let cancelled = false;
    let raf2 = 0;
    let hideTimer = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        hideTimer = window.setTimeout(() => {
          if (!cancelled) hideSplash(el, false);
        }, splashHideDelayMs(performance.now()));
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(hideTimer);
    };
    // Cold-start only — do not re-show on client navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
