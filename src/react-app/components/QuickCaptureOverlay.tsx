import QuickRecordButton from '@/react-app/components/QuickRecordButton';
import type { QuickCaptureLauncherState } from '@/react-app/hooks/useQuickCaptureLauncher';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';

type QuickCaptureOverlayProps = Pick<
  QuickCaptureLauncherState,
  | 'showQuickCapture'
  | 'primedMediaStream'
  | 'openedWithGestureCamera'
  | 'gesturePrimePending'
  | 'captureLaunchGeo'
  | 'captureLaunchGeoResolved'
  | 'closeQuickCapture'
>;

export default function QuickCaptureOverlay({
  showQuickCapture,
  primedMediaStream,
  openedWithGestureCamera,
  gesturePrimePending,
  captureLaunchGeo,
  captureLaunchGeoResolved,
  closeQuickCapture,
}: QuickCaptureOverlayProps) {
  const isMobile = useIsMobileViewport();
  if (!showQuickCapture || !isMobile) return null;

  return (
    <QuickRecordButton
      isOpen={showQuickCapture}
      primedMediaStream={primedMediaStream}
      gestureCameraPrimingPending={gesturePrimePending}
      autoRequestCamera={!openedWithGestureCamera && !gesturePrimePending}
      captureLaunchGeo={captureLaunchGeo}
      captureLaunchGeoResolved={captureLaunchGeoResolved}
      deferCameraUntilLaunchGeo
      onClose={closeQuickCapture}
    />
  );
}
