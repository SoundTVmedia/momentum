import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import { APP_SPLASH_ELEMENT_ID, shouldSkipAppSplash } from '@/react-app/lib/app-splash';

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
 * Keeps the HTML launch splash up until the first app frame has painted, then fades it out.
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
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) hideSplash(el, false);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // Cold-start only — do not re-show on client navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
