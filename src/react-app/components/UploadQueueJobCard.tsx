import { AlertCircle, Check, Loader2, RotateCcw, X } from 'lucide-react';
import type { ClipUploadQueueJob } from '@/react-app/contexts/ClipUploadQueueContext';
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

function UploadProgressRing({
  progress,
  tone,
}: {
  progress: number;
  tone: 'active' | 'paused' | 'failed' | 'published';
}) {
  const size = 56;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, progress));
  const offset = circumference - (pct / 100) * circumference;

  const trackClass =
    tone === 'failed'
      ? 'stroke-red-500/25'
      : tone === 'paused'
        ? 'stroke-amber-500/25'
        : tone === 'published'
          ? 'stroke-green-500/25'
          : 'stroke-white/15';

  const arcClass =
    tone === 'failed'
      ? 'stroke-red-400'
      : tone === 'paused'
        ? 'stroke-amber-400'
        : tone === 'published'
          ? 'stroke-green-400'
          : 'stroke-momentum-flare';

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={`${arcClass} transition-all duration-300`}
          strokeDasharray={circumference}
          strokeDashoffset={tone === 'published' ? 0 : offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {tone === 'published' ? (
          <Check className="h-5 w-5 text-green-400" aria-hidden />
        ) : tone === 'failed' ? (
          <AlertCircle className="h-5 w-5 text-red-400" aria-hidden />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
        )}
      </div>
    </div>
  );
}

export default function UploadQueueJobCard({ job, onRetry, onDismiss }: UploadQueueJobCardProps) {
  const label = uploadJobLabel(job);
  const statusText = uploadJobStatusText(job);
  const showProgress = uploadJobShowProgress(job);
  const canRetry = uploadJobCanRetry(job);
  const isPublished = job.status === 'published';
  const isFailed = job.status === 'failed' && !canRetry;
  const isPaused = job.status === 'paused';

  const ringTone = isPublished
    ? 'published'
    : isFailed
      ? 'failed'
      : isPaused
        ? 'paused'
        : 'active';

  const ringProgress = isPublished
    ? 100
    : Math.max(job.progress, job.status === 'queued' ? 8 : 12);

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
        <UploadProgressRing progress={ringProgress} tone={ringTone} />

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
          </div>

          {showProgress && !isPublished && (
            <p className="mt-2 text-[11px] text-gray-500 tabular-nums">{ringProgress}%</p>
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
