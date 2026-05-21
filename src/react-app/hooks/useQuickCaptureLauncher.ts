import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
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

    const geoPromise = primeGeolocationOnUserGesture();

    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setOpenedWithGestureCamera(false);
    setPrimedMediaStream(null);
    setGesturePrimePending(true);
    setShowQuickCapture(true);

    void geoPromise
      .then((g) => {
        setCaptureLaunchGeo(g);
        setCaptureLaunchGeoResolved(true);
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
        setGesturePrimePending(false);
      });
  }, [isPending, navigate, user]);

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
