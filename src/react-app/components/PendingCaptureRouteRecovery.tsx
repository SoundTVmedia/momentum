import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import { loadPendingCapture } from '@/react-app/lib/upload-outbox/capture-local-save';

/** Send users back to /upload when a pre-Share clip is still on this device. */
export default function PendingCaptureRouteRecovery() {
  const { user, isPending } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { jobs } = useClipUploadQueue();

  useEffect(() => {
    if (isPending || !user || location.pathname === '/upload') return;

    const hasActiveUpload = jobs.some(
      (j) =>
        j.status === 'queued' ||
        j.status === 'classifying' ||
        j.status === 'uploading' ||
        j.status === 'completing' ||
        j.status === 'processing' ||
        j.status === 'paused',
    );
    if (hasActiveUpload) return;

    let cancelled = false;
    void (async () => {
      const pending = await loadPendingCapture();
      if (cancelled || !pending?.video) return;
      navigate('/upload', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, user, location.pathname, navigate, jobs]);

  return null;
}
