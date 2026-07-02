import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import ClipDeepLinkHandler from '@/react-app/components/ClipDeepLinkHandler';
import PerfDebugOverlay from '@/react-app/components/PerfDebugOverlay';
import MobileBottomNav from '@/react-app/components/MobileBottomNav';
import QuickCaptureOverlay from '@/react-app/components/QuickCaptureOverlay';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { useQuickCapture } from '@/react-app/contexts/QuickCaptureContext';
import { MOBILE_PAGE_INSET_BOTTOM_CLASS } from '@/react-app/lib/mobileBottomNavLayout';
import { acquireNativeCaptureChromeLock } from '@/react-app/lib/native-capture/chrome';
import {
  forceStopNativeCaptureSession,
  shouldUseNativeIosCapture,
} from '@/react-app/lib/native-capture';

function shouldHideBottomNavForPath(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

/** Wraps routed pages with mobile bottom inset when the tab bar is visible. */
export default function AppRouteChrome() {
  const { hideBottomNav, setHideBottomNav } = useMobileChrome();
  const { pathname } = useLocation();
  const quickCapture = useQuickCapture();
  const showMobileNavInset = !hideBottomNav && !shouldHideBottomNavForPath(pathname);
  const hideRouteContentForNativeCapture =
    quickCapture.showQuickCapture && shouldUseNativeIosCapture();

  useEffect(() => {
    if (!quickCapture.showQuickCapture) {
      return;
    }
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [quickCapture.showQuickCapture, setHideBottomNav]);

  useLayoutEffect(() => {
    if (!hideRouteContentForNativeCapture) {
      return;
    }
    return acquireNativeCaptureChromeLock();
  }, [hideRouteContentForNativeCapture]);

  useEffect(() => {
    if (!shouldUseNativeIosCapture()) return;
    if (quickCapture.showQuickCapture) return;
    void forceStopNativeCaptureSession();
  }, [quickCapture.showQuickCapture]);

  return (
    <>
      <div
        className={`app-route-outlet ${showMobileNavInset ? MOBILE_PAGE_INSET_BOTTOM_CLASS : ''}`}
        aria-hidden={hideRouteContentForNativeCapture ? true : undefined}
      >
        <Outlet />
      </div>
      <MobileBottomNav />
      <QuickCaptureOverlay {...quickCapture} />
      <ClipDeepLinkHandler />
      <PerfDebugOverlay />
    </>
  );
}
