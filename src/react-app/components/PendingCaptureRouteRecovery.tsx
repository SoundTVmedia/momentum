import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import { loadPendingCapture } from '@/react-app/lib/upload-outbox/capture-local-save';
import {
  captureReviewSearch,
  isCaptureBlobConsumed,
  isCaptureReviewRecoveryBlocked,
  wasCaptureRecentlyDiscarded,
  wasCaptureRecentlyShared,
  wasBlobRecentlyShared,
} from '@/react-app/lib/upload-outbox/capture-handoff';

const ACTIVE_UPLOAD_STATUSES = new Set([
  'queued',
  'classifying',
  'uploading',
  'completing',
  'processing',
  'paused',
  'published',
]);

/** Send users back to /upload when a pre-Share clip is still on this device. */
export default function PendingCaptureRouteRecovery() {
  const { user, isPending } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { jobs } = useClipUploadQueue();

  useEffect(() => {
    if (isPending || !user || location.pathname === '/upload') return;

    const hasActiveUpload = jobs.some((j) => ACTIVE_UPLOAD_STATUSES.has(j.status));
    if (hasActiveUpload) return;

    let cancelled = false;
    void (async () => {
      if (
        wasCaptureRecentlyDiscarded() ||
        wasCaptureRecentlyShared() ||
        isCaptureReviewRecoveryBlocked()
      ) {
        return;
      }
      const pending = await loadPendingCapture();
      if (cancelled || !pending?.video) return;
      if (wasBlobRecentlyShared(pending.video) || isCaptureBlobConsumed(pending.video)) return;
      navigate({ pathname: '/upload', search: captureReviewSearch() }, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, user, location.pathname, navigate, jobs]);

  return null;
}
