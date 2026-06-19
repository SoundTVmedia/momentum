import { useEffect, useState } from 'react';
import { AlertCircle, Check, Film, Loader2, RotateCcw, X } from 'lucide-react';
import type { ClipUploadQueueJob } from '@/react-app/contexts/ClipUploadQueueContext';
import { resolveOutboxBlobs } from '@/react-app/lib/upload-outbox/blob-store';
import {
  uploadJobCanRetry,
  uploadJobLabel,
  uploadJobShowProgress,
  uploadJobStatusText,
} from '@/react-app/lib/upload-outbox/upload-queue-status';

type UploadQueueJobCardProps = {
  job: ClipUploadQueueJob;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
};

export default function UploadQueueJobCard({ job, onRetry, onDismiss }: UploadQueueJobCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(job.previewObjectUrl);

  useEffect(() => {
    if (job.previewObjectUrl) {
      setPreviewUrl(job.previewObjectUrl);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      const blobs = await resolveOutboxBlobs(job.id);
      if (cancelled) return;
      const source = blobs?.thumbnail ?? blobs?.video;
      if (!source) return;
      objectUrl = URL.createObjectURL(source);
      setPreviewUrl(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [job.id, job.previewObjectUrl]);

  const label = uploadJobLabel(job);
  const statusText = uploadJobStatusText(job);
  const showProgress = uploadJobShowProgress(job);
  const canRetry = uploadJobCanRetry(job);
  const isPublished = job.status === 'published';
  const isFailed = job.status === 'failed' && !canRetry;
  const isPaused = job.status === 'paused';

  return (
    <div
      className={`rounded-xl border px-4 py-4 shadow-lg backdrop-blur-md ${
        isPublished
          ? 'border-green-500/40 bg-green-950/50'
          : isFailed
            ? 'border-red-500/40 bg-red-950/40'
            : isPaused
              ? 'border-amber-500/40 bg-amber-950/40'
              : 'border-white/15 bg-black/50'
      }`}
    >
      <div className="flex gap-3">
        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="h-6 w-6 text-gray-500" aria-hidden />
            </div>
          )}
          {!isPublished && !isFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{label}</p>
              <p
                className={`mt-1 text-xs leading-snug ${
                  isPublished
                    ? 'text-green-200/90'
                    : isFailed
                      ? 'text-red-200/90'
                      : isPaused
                        ? 'text-amber-200/90'
                        : 'text-gray-400'
                }`}
              >
                {statusText}
              </p>
            </div>
            {isPublished ? (
              <Check className="h-5 w-5 shrink-0 text-green-400" aria-hidden />
            ) : isFailed ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
            ) : null}
          </div>

          {showProgress && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all duration-300 ${
                  isFailed
                    ? 'bg-red-500/80'
                    : isPaused
                      ? 'bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600'
                      : 'bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember'
                }`}
                style={{ width: `${Math.max(job.progress, job.status === 'queued' ? 8 : 12)}%` }}
              />
            </div>
          )}

          {(canRetry || isFailed) && (
            <div className="mt-3 flex gap-2">
              {canRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Retry
                </button>
              )}
              {isFailed && (
                <button
                  type="button"
                  onClick={() => onDismiss(job.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
