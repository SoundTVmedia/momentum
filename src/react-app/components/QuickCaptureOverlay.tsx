import QuickRecordButton from '@/react-app/components/QuickRecordButton';
import type { QuickCaptureLauncherState } from '@/react-app/hooks/useQuickCaptureLauncher';
import { shouldUseNativeIosCapture } from '@/react-app/lib/native-capture';

type QuickCaptureOverlayProps = Pick<
  QuickCaptureLauncherState,
  | 'showQuickCapture'
  | 'primedMediaStream'
  | 'openedWithGestureCamera'
  | 'gesturePrimePending'
  | 'captureLaunchGeo'
  | 'captureLaunchGeoResolved'
  | 'captureReopenWarmupPending'
  | 'closeQuickCapture'
  | 'dismissQuickCaptureOverlay'
>;

export default function QuickCaptureOverlay({
  showQuickCapture,
  primedMediaStream,
  openedWithGestureCamera,
  gesturePrimePending,
  captureLaunchGeo,
  captureLaunchGeoResolved,
  captureReopenWarmupPending,
  closeQuickCapture,
  dismissQuickCaptureOverlay,
}: QuickCaptureOverlayProps) {
  if (!showQuickCapture) return null;

  const nativeIos = shouldUseNativeIosCapture();

  return (
    <QuickRecordButton
      isOpen={showQuickCapture}
      primedMediaStream={primedMediaStream}
      gestureCameraPrimingPending={gesturePrimePending}
      captureReopenWarmupPending={captureReopenWarmupPending}
      autoRequestCamera={!openedWithGestureCamera && !gesturePrimePending && !captureReopenWarmupPending}
      captureLaunchGeo={captureLaunchGeo}
      captureLaunchGeoResolved={captureLaunchGeoResolved}
      deferCameraUntilLaunchGeo={!nativeIos || captureReopenWarmupPending}
      onAfterCaptureNavigate={dismissQuickCaptureOverlay}
      onClose={closeQuickCapture}
    />
  );
}
