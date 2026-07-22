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
  isNativeCapturePreviewRunning,
} from '@/react-app/lib/native-capture';
import {
  isCaptureSessionBusy,
  isCaptureReopenPending,
  isCaptureHandoffBusy,
  wantsCaptureReviewScreen,
} from '@/react-app/lib/upload-outbox/capture-handoff';

function shouldHideBottomNavForPath(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

/** Wraps routed pages with mobile bottom inset when the tab bar is visible. */
export default function AppRouteChrome() {
  const { hideBottomNav, setHideBottomNav } = useMobileChrome();
  const { pathname, search } = useLocation();
  const quickCapture = useQuickCapture();
  const showMobileNavInset = !hideBottomNav && !shouldHideBottomNavForPath(pathname);
  const onCaptureReviewRoute =
    pathname === '/upload' && wantsCaptureReviewScreen(search);
  const hideRouteContentForNativeCapture =
    quickCapture.showQuickCapture &&
    shouldUseNativeIosCapture() &&
    !onCaptureReviewRoute;

  useLayoutEffect(() => {
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
    if (isCaptureSessionBusy()) return;
    if (isCaptureHandoffBusy()) return;
    if (isCaptureReopenPending()) return;
    if (!isNativeCapturePreviewRunning()) return;
    void forceStopNativeCaptureSession({ restorePlayback: true });
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
      {(!onCaptureReviewRoute || isCaptureReopenPending()) && (
        <QuickCaptureOverlay {...quickCapture} />
      )}
      <ClipDeepLinkHandler />
      <PerfDebugOverlay />
    </>
  );
}
