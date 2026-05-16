import { useState, useEffect } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import QuickRecordButton from './QuickRecordButton';
import { primeCameraOnUserGesture } from '@/react-app/utils/primeCameraOnUserGesture';
import {
  primeGeolocationOnUserGesture,
  isGeolocationSecureContext,
  type PrimedCaptureGeo,
} from '@/react-app/utils/primeGeolocationOnUserGesture';

interface QuickRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'consent' | 'capture';

/**
 * Location + camera must start from a real tap (iOS Safari). After Continue, priming matches MobileBottomNav.
 */
export default function QuickRecordModal({ isOpen, onClose }: QuickRecordModalProps) {
  const [step, setStep] = useState<Step>('consent');
  const [captureLaunchGeo, setCaptureLaunchGeo] = useState<PrimedCaptureGeo | null>(null);
  const [captureLaunchGeoResolved, setCaptureLaunchGeoResolved] = useState(false);
  const [primedStream, setPrimedStream] = useState<MediaStream | null>(null);
  const [gesturePending, setGesturePending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep('consent');
      setPrimedStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
      setCaptureLaunchGeo(null);
      setCaptureLaunchGeoResolved(false);
      setGesturePending(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (step === 'consent') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 text-center">
        <MapPin className="mb-4 h-14 w-14 shrink-0 text-cyan-400" aria-hidden />
        <h2 className="mb-2 text-xl font-bold text-white">Location and camera</h2>
        <p className="mb-8 max-w-sm text-sm leading-relaxed text-gray-400">
          Tap continue so your browser can ask for location (venue suggestions), then camera and microphone for your clip
          and song recognition.
        </p>
        {!isGeolocationSecureContext() && (
          <p className="mb-6 max-w-sm text-xs leading-relaxed text-amber-200/90">
            Chrome only allows location on HTTPS or localhost. Open the app over HTTPS (or use localhost) for the
            location prompt to appear.
          </p>
        )}
        <button
          type="button"
          disabled={gesturePending}
          className="w-full max-w-xs rounded-xl momentum-grad-interactive px-6 py-4 font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
          onClick={() => {
            const geoPromise = primeGeolocationOnUserGesture();
            setGesturePending(true);
            setCaptureLaunchGeoResolved(false);
            void geoPromise
              .then((g) => {
                setCaptureLaunchGeo(g);
                setCaptureLaunchGeoResolved(true);
                return primeCameraOnUserGesture();
              })
              .then((stream) => {
                setPrimedStream(stream);
                setStep('capture');
              })
              .catch(() => {
                setPrimedStream(null);
                setCaptureLaunchGeoResolved(true);
                setStep('capture');
              })
              .finally(() => setGesturePending(false));
          }}
        >
          {gesturePending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Starting…
            </span>
          ) : (
            'Continue'
          )}
        </button>
        <button type="button" className="mt-6 text-sm text-gray-500 hover:text-gray-300" onClick={onClose}>
          Cancel
        </button>
      </div>
    );
  }

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
