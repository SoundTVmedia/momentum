import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';
import {
  shouldUseNativeIosCapture,
  startNativeCapturePreview,
} from '@/react-app/lib/native-capture';
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
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
};

/** Opens QuickRecord with geolocation + camera primed on the same user gesture (iOS Safari). */
export function useQuickCaptureLauncher(): QuickCaptureLauncherState {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const isMobile = useIsMobileViewport();
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [primedMediaStream, setPrimedMediaStream] = useState<MediaStream | null>(null);
  const [openedWithGestureCamera, setOpenedWithGestureCamera] = useState(false);
  const [gesturePrimePending, setGesturePrimePending] = useState(false);
  const [captureLaunchGeo, setCaptureLaunchGeo] = useState<PrimedCaptureGeo | null>(null);
  const [captureLaunchGeoResolved, setCaptureLaunchGeoResolved] = useState(false);

  const closeQuickCapture = useCallback(() => {
    primedMediaStream?.getTracks().forEach((t) => t.stop());
    setPrimedMediaStream(null);
    setOpenedWithGestureCamera(false);
    setGesturePrimePending(false);
    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setShowQuickCapture(false);
  }, [primedMediaStream]);

  const openQuickCapture = useCallback(() => {
    if (isPending) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isMobile) {
      navigate('/upload');
      return;
    }

    const nativeIos = shouldUseNativeIosCapture();
    const geoPromise = primeGeolocationOnUserGesture();

    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setOpenedWithGestureCamera(false);
    setPrimedMediaStream(null);
    setGesturePrimePending(!nativeIos);
    setShowQuickCapture(true);

    if (nativeIos) {
      void startNativeCapturePreview().catch((err) => {
        console.warn('useQuickCaptureLauncher: native camera preview failed on open', err);
      });
    }

    void geoPromise
      .then((g) => {
        setCaptureLaunchGeo(g);
        if (nativeIos) {
          return null;
        }
        return primeCameraOnUserGesture();
      })
      .then((stream) => {
        if (nativeIos) {
          setOpenedWithGestureCamera(false);
          setPrimedMediaStream(null);
          return;
        }
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
  }, [isPending, isMobile, navigate, user]);

  return {
    showQuickCapture,
    primedMediaStream,
    openedWithGestureCamera,
    gesturePrimePending,
    captureLaunchGeo,
    captureLaunchGeoResolved,
    openQuickCapture,
    closeQuickCapture,
  };
}
