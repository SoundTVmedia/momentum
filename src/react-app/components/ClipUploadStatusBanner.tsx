import { Loader2, Check, AlertCircle, X } from 'lucide-react';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';

/** Shows background clip upload progress (used on `/upload`). */
export default function ClipUploadStatusBanner() {
  const { jobs, retryJob, dismissJob } = useClipUploadQueue();

  const visible = jobs.filter(
    (j) =>
      j.status === 'pending' ||
      j.status === 'uploading' ||
      j.status === 'error' ||
      j.status === 'done',
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

          if (job.status === 'done') {
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

          if (job.status === 'error') {
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
                  onClick={() => retryJob(job.id)}
                  className="shrink-0 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 px-2.5 py-1 rounded-lg"
                >
                  Retry
                </button>
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

          const pct =
            job.progress.video < 100
              ? job.progress.video
              : job.progress.thumbnail > 0 && job.progress.thumbnail < 100
                ? job.progress.thumbnail
                : job.progress.video;

          const statusText =
            job.status === 'pending'
              ? 'Waiting to upload…'
              : job.progress.video < 100
                ? 'Uploading video…'
                : job.progress.thumbnail > 0 && job.progress.thumbnail < 100
                  ? 'Uploading thumbnail…'
                  : 'Publishing…';

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
                  style={{ width: `${Math.max(pct, job.status === 'pending' ? 8 : 12)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
