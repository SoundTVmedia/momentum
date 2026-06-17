import { Loader2, Check, AlertCircle, X } from 'lucide-react';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import { isRetryableUploadError } from '@/react-app/lib/upload-outbox/blob-store';
import { isNetworkAvailable } from '@/react-app/lib/upload-outbox/network-utils';

/** Shows background clip upload progress app-wide. */
export default function ClipUploadStatusBanner() {
  const { jobs, dismissJob } = useClipUploadQueue();

  const visible = jobs.filter(
    (j) =>
      j.status === 'queued' ||
      j.status === 'classifying' ||
      j.status === 'uploading' ||
      j.status === 'completing' ||
      j.status === 'processing' ||
      j.status === 'paused' ||
      j.status === 'failed' ||
      j.status === 'published',
  );

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] px-3 pt-3 pointer-events-none">
      <div className="max-w-2xl mx-auto space-y-2 pointer-events-auto">
        {visible.map((job) => {
          const label =
            job.form.artist_name?.trim() ||
            job.form.venue_name?.trim() ||
            'Your clip';

          if (job.status === 'published') {
            return (
              <div
                key={job.id}
                className="flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-950/90 px-4 py-3 text-sm text-green-100 shadow-lg backdrop-blur-md"
              >
                <Check className="w-5 h-5 shrink-0 text-green-400" aria-hidden />
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium">{label}</span> posted
                </span>
              </div>
            );
          }

          if (job.status === 'paused') {
            const pct = job.progress;
            return (
              <div
                key={job.id}
                className="rounded-xl border border-amber-500/40 bg-amber-950/90 px-4 py-3 text-sm text-amber-100 shadow-lg backdrop-blur-md"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-5 h-5 shrink-0 text-amber-400 animate-spin" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{label}</p>
                    <p className="text-amber-200/90 text-xs mt-0.5">
                      Connection issue — your clip is saved on this device. Retrying upload
                      automatically…
                    </p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 transition-all duration-300"
                    style={{ width: `${Math.max(pct, 12)}%` }}
                  />
                </div>
              </div>
            );
          }

          if (job.status === 'failed') {
            const autoRetrying = isRetryableUploadError(job.error);
            if (autoRetrying) {
              const pct = job.progress;
              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-amber-500/40 bg-amber-950/90 px-4 py-3 text-sm text-amber-100 shadow-lg backdrop-blur-md"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-5 h-5 shrink-0 text-amber-400 animate-spin" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{label}</p>
                      <p className="text-amber-200/90 text-xs mt-0.5">
                        Retrying upload automatically…
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 transition-all duration-300"
                      style={{ width: `${Math.max(pct, 12)}%` }}
                    />
                  </div>
                </div>
              );
            }
            return (
              <div
                key={job.id}
                className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/90 px-4 py-3 text-sm text-red-100 shadow-lg backdrop-blur-md"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{label}</p>
                  <p className="text-red-200/90 text-xs mt-0.5">{job.error ?? 'Upload failed'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissJob(job.id)}
                  className="shrink-0 p-1 text-red-300 hover:text-white"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          }

          const pct = job.progress;
          const statusText =
            job.status === 'queued' && !isNetworkAvailable()
              ? 'Saved on device — waiting for connection…'
              : job.status === 'queued'
                ? 'Waiting to upload…'
                  : job.status === 'classifying'
                    ? 'Checking clip…'
                    : job.status === 'uploading'
                      ? 'Uploading video…'
                      : job.status === 'completing'
                        ? 'Finishing upload…'
                        : 'Processing…';

          return (
            <div
              key={job.id}
              className="rounded-xl border border-white/15 bg-black/85 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-md"
            >
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 shrink-0 text-momentum-flare animate-spin" aria-hidden />
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium">{label}</span> — {statusText}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember transition-all duration-300"
                  style={{ width: `${Math.max(pct, job.status === 'queued' ? 8 : 12)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
