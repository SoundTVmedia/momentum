import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';
import {
  shouldUseNativeIosCapture,
  forceStopNativeCaptureSession,
  waitForNativeCaptureIdle,
  settleNativeCaptureSession,
} from '@/react-app/lib/native-capture';
import {
  allowCaptureReviewRecovery,
  blockCaptureReviewRecovery,
  clearCaptureHandoffMeta,
  clearCaptureHandoffBusy,
  clearCaptureReopenPending,
  clearPendingCaptureReviewHandoff,
  isCaptureReopenPending,
  isCaptureSessionBusy,
  markCaptureReopenPending,
  wantsCaptureReviewScreen,
} from '@/react-app/lib/upload-outbox/capture-handoff';
import { resetStaleCaptureSessionUnlessOnReview } from '@/react-app/lib/upload-outbox/capture-local-save';

const CAPTURE_OPEN_BUSY_POLL_MS = 120;
const CAPTURE_OPEN_BUSY_MAX_MS = 12_000;
import { primeCameraOnUserGesture } from '@/react-app/utils/primeCameraOnUserGesture';
import {
  primeGeolocationOnUserGesture,
  type PrimedCaptureGeo,
} from '@/react-app/utils/primeGeolocationOnUserGesture';

export type QuickCaptureLauncherState = {
  showQuickCapture: boolean;
  primedMediaStream: MediaStream | null;
  openedWithGestureCamera: boolean;
  gesturePrimePending: boolean;
  captureLaunchGeo: PrimedCaptureGeo | null;
  captureLaunchGeoResolved: boolean;
  /** Native iOS — defer camera start until post-Share native I/O settles. */
  captureReopenWarmupPending: boolean;
  openQuickCapture: () => void;
  /** After Share — bypass busy lock and open overlay immediately for the next clip. */
  openQuickCaptureAfterShare: () => void;
  /** X / cancel — return to feed and discard in-progress capture. */
  closeQuickCapture: () => void;
  /** After handoff navigates to caption — hide overlay only; keep handoff meta. */
  dismissQuickCaptureOverlay: () => void;
};

/** Opens QuickRecord with geolocation + camera primed on the same user gesture (iOS Safari). */
export function useQuickCaptureLauncher(): QuickCaptureLauncherState {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const isMobile = useIsMobileViewport();
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [primedMediaStream, setPrimedMediaStream] = useState<MediaStream | null>(null);
  const [openedWithGestureCamera, setOpenedWithGestureCamera] = useState(false);
  const [gesturePrimePending, setGesturePrimePending] = useState(false);
  const [captureLaunchGeo, setCaptureLaunchGeo] = useState<PrimedCaptureGeo | null>(null);
  const [captureLaunchGeoResolved, setCaptureLaunchGeoResolved] = useState(false);
  const [captureReopenWarmupPending, setCaptureReopenWarmupPending] = useState(false);

  const dismissQuickCaptureOverlay = useCallback(() => {
    primedMediaStream?.getTracks().forEach((t) => t.stop());
    setPrimedMediaStream(null);
    setOpenedWithGestureCamera(false);
    setGesturePrimePending(false);
    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setCaptureReopenWarmupPending(false);
    setShowQuickCapture(false);
  }, [primedMediaStream]);

  // Safety net: caption route must not sit under the feed capture overlay (TestFlight timing).
  useEffect(() => {
    if (isCaptureReopenPending()) return;
    if (location.pathname !== '/upload') return;
    if (!wantsCaptureReviewScreen(location.search)) return;
    if (!showQuickCapture) return;
    dismissQuickCaptureOverlay();
  }, [
    location.pathname,
    location.search,
    showQuickCapture,
    dismissQuickCaptureOverlay,
  ]);

  const closeQuickCapture = useCallback(() => {
    primedMediaStream?.getTracks().forEach((t) => t.stop());
    setPrimedMediaStream(null);
    setOpenedWithGestureCamera(false);
    setGesturePrimePending(false);
    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setCaptureReopenWarmupPending(false);
    setShowQuickCapture(false);
    clearCaptureReopenPending();
    blockCaptureReviewRecovery();
    clearCaptureHandoffMeta();
    resetStaleCaptureSessionUnlessOnReview('/', '');
    navigate('/', { replace: true });
    if (shouldUseNativeIosCapture()) {
      void forceStopNativeCaptureSession({ restorePlayback: true });
    }
  }, [navigate, primedMediaStream]);

  const openQuickCaptureNow = useCallback(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isMobile) {
      navigate('/upload');
      return;
    }

    const nativeIos = shouldUseNativeIosCapture();
    // Clear stale post-Share blocks from localStorage before the first capture of a session.
    allowCaptureReviewRecovery();
    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setCaptureReopenWarmupPending(false);
    setOpenedWithGestureCamera(false);
    setPrimedMediaStream(null);
    setGesturePrimePending(!nativeIos);
    setShowQuickCapture(true);
    clearCaptureReopenPending();

    if (nativeIos) {
      void primeGeolocationOnUserGesture()
        .then((g) => {
          setCaptureLaunchGeo(g);
        })
        .catch((err) => {
          console.warn('useQuickCaptureLauncher: geolocation failed on open', err);
        })
        .finally(() => {
          setCaptureLaunchGeoResolved(true);
          setGesturePrimePending(false);
        });
      return;
    }

    const geoPromise = primeGeolocationOnUserGesture();

    void geoPromise
      .then((g) => {
        setCaptureLaunchGeo(g);
        return primeCameraOnUserGesture();
      })
      .then((stream) => {
        setOpenedWithGestureCamera(!!stream);
        setPrimedMediaStream(stream);
      })
      .catch(() => {
        setOpenedWithGestureCamera(false);
        setPrimedMediaStream(null);
      })
      .finally(() => {
        setCaptureLaunchGeoResolved(true);
        setGesturePrimePending(false);
      });
  }, [isMobile, navigate, user]);

  const openQuickCapture = useCallback(() => {
    if (isPending) return;

    const onCaptureReviewRoute =
      location.pathname === '/upload' && wantsCaptureReviewScreen(location.search);

    // Stale primed blob / handoff flags from a finished session block reopen forever.
    resetStaleCaptureSessionUnlessOnReview(location.pathname, location.search);

    const tryOpen = () => {
      if (isCaptureSessionBusy()) return false;
      openQuickCaptureNow();
      return true;
    };

    if (tryOpen()) return;

    const started = Date.now();
    const poll = () => {
      if (tryOpen()) return;
      if (Date.now() - started >= CAPTURE_OPEN_BUSY_MAX_MS) {
        if (!onCaptureReviewRoute) {
          resetStaleCaptureSessionUnlessOnReview(location.pathname, location.search);
          openQuickCaptureNow();
        } else {
          console.warn('useQuickCaptureLauncher: capture session still busy — could not reopen camera');
        }
        return;
      }
      window.setTimeout(poll, CAPTURE_OPEN_BUSY_POLL_MS);
    };
    window.setTimeout(poll, CAPTURE_OPEN_BUSY_POLL_MS);
  }, [isPending, location.pathname, location.search, openQuickCaptureNow]);

  const openQuickCaptureAfterShareNow = useCallback(() => {
    clearCaptureHandoffBusy();
    clearPendingCaptureReviewHandoff();
    resetStaleCaptureSessionUnlessOnReview('/', '');

    const nativeIos = shouldUseNativeIosCapture();
    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setOpenedWithGestureCamera(false);
    setPrimedMediaStream(null);
    setGesturePrimePending(false);
    setCaptureReopenWarmupPending(nativeIos);
    setShowQuickCapture(true);

    void primeGeolocationOnUserGesture()
      .then((g) => setCaptureLaunchGeo(g))
      .catch((err) => {
        console.warn('useQuickCaptureLauncher: geolocation failed after share', err);
      });

    void (async () => {
      if (nativeIos) {
        await waitForNativeCaptureIdle(15_000);
        await forceStopNativeCaptureSession();
        await settleNativeCaptureSession(600);
      }
      setCaptureReopenWarmupPending(false);
      setCaptureLaunchGeoResolved(true);
    })();
  }, []);

  /** Schedule camera reopen after Share — waits until router leaves ?reviewCapture. */
  const openQuickCaptureAfterShare = useCallback(() => {
    markCaptureReopenPending();
  }, []);

  // Opening capture while still on /upload?reviewCapture races AppRouteChrome and dismisses the overlay.
  useEffect(() => {
    if (!isCaptureReopenPending()) return;
    const onCaptureReviewRoute =
      location.pathname === '/upload' && wantsCaptureReviewScreen(location.search);
    if (onCaptureReviewRoute) return;
    clearCaptureReopenPending();
    openQuickCaptureAfterShareNow();
  }, [location.pathname, location.search, openQuickCaptureAfterShareNow]);

  return {
    showQuickCapture,
    primedMediaStream,
    openedWithGestureCamera,
    gesturePrimePending,
    captureLaunchGeo,
    captureLaunchGeoResolved,
    captureReopenWarmupPending,
    openQuickCapture,
    openQuickCaptureAfterShare,
    closeQuickCapture,
    dismissQuickCaptureOverlay,
  };
}
