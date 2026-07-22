import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import {
  clearPendingCapture,
  loadPendingCapture,
} from '@/react-app/lib/upload-outbox/capture-local-save';
import {
  captureReviewSearch,
  isCaptureBlobConsumed,
  shouldSkipCaptureReviewHydration,
  wasBlobRecentlyShared,
  wasCaptureRecentlyDiscarded,
  wasRecordingStartedAtShared,
  readCaptureHandoffMeta,
} from '@/react-app/lib/upload-outbox/capture-handoff';

/** Send users back to /upload when a pre-Share clip is still on this device. */
export default function PendingCaptureRouteRecovery() {
  const { user, isPending } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending || !user || location.pathname === '/upload') return;

    let cancelled = false;
    void (async () => {
      if (shouldSkipCaptureReviewHydration() || wasCaptureRecentlyDiscarded()) {
        return;
      }

      const pending = await loadPendingCapture();
      if (cancelled || !pending?.video) return;
      if (wasBlobRecentlyShared(pending.video) || isCaptureBlobConsumed(pending.video)) {
        await clearPendingCapture();
        return;
      }

      const handoffAt = readCaptureHandoffMeta()?.recordingStartedAt;
      if (wasRecordingStartedAtShared(handoffAt)) {
        await clearPendingCapture();
        return;
      }

      navigate({ pathname: '/upload', search: captureReviewSearch() }, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally omit upload `jobs` — when a published job is removed (~8s after
    // upload) this must NOT re-run and resurrect the caption screen from stale IDB data.
  }, [isPending, user, location.pathname, navigate]);

  return null;
}
