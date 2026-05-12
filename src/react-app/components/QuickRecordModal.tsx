import { useState, useEffect } from 'react';
import QuickRecordButton from './QuickRecordButton';
import { primeCameraOnUserGesture } from '@/react-app/utils/primeCameraOnUserGesture';
import {
  primeGeolocationOnUserGesture,
  type PrimedCaptureGeo,
} from '@/react-app/utils/primeGeolocationOnUserGesture';

interface QuickRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen capture with location → camera/mic priming (same ordering as MobileBottomNav)
 * so venue resolve and AudD get GPS + audio when the browser allows.
 */
export default function QuickRecordModal({ isOpen, onClose }: QuickRecordModalProps) {
  const [captureLaunchGeo, setCaptureLaunchGeo] = useState<PrimedCaptureGeo | null>(null);
  const [captureLaunchGeoResolved, setCaptureLaunchGeoResolved] = useState(false);
  const [primedStream, setPrimedStream] = useState<MediaStream | null>(null);
  const [gesturePending, setGesturePending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPrimedStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
      setCaptureLaunchGeo(null);
      setCaptureLaunchGeoResolved(false);
      setGesturePending(false);
      return;
    }

    setGesturePending(true);
    setCaptureLaunchGeoResolved(false);
    let cancelled = false;

    void (async () => {
      try {
        const g = await primeGeolocationOnUserGesture();
        if (cancelled) return;
        setCaptureLaunchGeo(g);
        setCaptureLaunchGeoResolved(true);
        const stream = await primeCameraOnUserGesture();
        if (cancelled) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        setPrimedStream(stream);
      } catch {
        if (!cancelled) setPrimedStream(null);
      } finally {
        if (!cancelled) setGesturePending(false);
      }
    })();

    return () => {
      cancelled = true;
      setPrimedStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <QuickRecordButton
      isOpen={isOpen}
      onClose={onClose}
      primedMediaStream={primedStream}
      autoRequestCamera={!primedStream && !gesturePending}
      gestureCameraPrimingPending={gesturePending}
      captureLaunchGeo={captureLaunchGeo}
      captureLaunchGeoResolved={captureLaunchGeoResolved}
      deferCameraUntilLaunchGeo
    />
  );
}
