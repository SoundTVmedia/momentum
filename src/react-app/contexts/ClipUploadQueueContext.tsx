import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import {
  clearCachedOutboxBlobs,
  formatUploadError,
  isRetryableUploadError,
  persistOutboxThumbnail,
  persistOutboxVideo,
  resolveOutboxBlobs,
} from '@/react-app/lib/upload-outbox/blob-store';
import {
  deleteOutboxJob,
  loadOutboxBlobs,
  loadOutboxMeta,
  saveOutboxMeta,
} from '@/react-app/lib/upload-outbox/idb';
import { jobFromPayload, runOutboxJob } from '@/react-app/lib/upload-outbox/runner';
import type { PersistedOutboxMeta, UploadOutboxJob } from '@/react-app/lib/upload-outbox/types';
import { saveClipToDeviceGallery } from '@/react-app/lib/upload-outbox/gallery-save';
import {
  acquireUploadWakeLock,
  bindUploadWakeLockVisibility,
  releaseUploadWakeLock,
} from '@/react-app/lib/upload-outbox/upload-wake-lock';
import { scheduleNativeBackgroundUpload } from '@/react-app/lib/native-bridge';
import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';

const MAX_QUEUE_SIZE = 5;
const DONE_TTL_MS = 8000;
const PAUSED_RETRY_INTERVAL_MS = 45_000;

export type ClipUploadQueueJob = UploadOutboxJob;

type ClipUploadQueueValue = {
  jobs: ClipUploadQueueJob[];
  activeCount: number;
  enqueue: (payload: ClipUploadJobPayload, previewObjectUrl?: string | null) => string | null;
  retryJob: (id: string) => void;
  dismissJob: (id: string) => void;
};

const ClipUploadQueueContext = createContext<ClipUploadQueueValue | null>(null);

function toPersisted(job: UploadOutboxJob): PersistedOutboxMeta {
  const {
    videoFile: _vf,
    videoBlob: _vb,
    thumbnailFile: _tf,
    captureAudioBlob: _ca,
    ...meta
  } = job;
  return meta;
}

function reviveJob(meta: PersistedOutboxMeta): UploadOutboxJob {
  return {
    ...meta,
    blobsReady: meta.blobsReady ?? false,
    videoFile: null,
    videoBlob: null,
    thumbnailFile: null,
    captureAudioBlob: null,
  };
}

export function ClipUploadQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ClipUploadQueueJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const persist = useCallback(async (next: ClipUploadQueueJob[]) => {
    const active = next.filter((j) => j.status !== 'published');
    await saveOutboxMeta(active.map(toPersisted));
  }, []);

  const updateJob = useCallback(
    (id: string, patch: Partial<ClipUploadQueueJob>) => {
      setJobs((prev) => {
        const next = prev.map((j) => (j.id === id ? { ...j, ...patch } : j));
        jobsRef.current = next;
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeJobLater = useCallback((id: string) => {
    window.setTimeout(() => {
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== id);
        jobsRef.current = next;
        void persist(next);
        return next;
      });
    }, DONE_TTL_MS);
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await loadOutboxMeta();
        if (cancelled) return;

        const revived: UploadOutboxJob[] = [];
        for (const m of meta) {
          let job = reviveJob(m);
          if (
            job.status === 'uploading' ||
            job.status === 'completing' ||
            job.status === 'classifying' ||
            job.status === 'processing' ||
            job.status === 'paused'
          ) {
            job = { ...job, status: 'queued' };
          }

          const blobs = await loadOutboxBlobs(job.id);
          if (blobs?.video) {
            job = { ...job, blobsReady: true };
          } else if (job.uploadMethod === 'url' && job.videoUrl?.trim()) {
            job = { ...job, blobsReady: true };
          } else if (job.status === 'queued' || job.status === 'failed') {
            job = {
              ...job,
              blobsReady: false,
              status: 'failed',
              error:
                'Clip video is not on this device anymore. Record and post again if needed.',
            };
          }

          revived.push(job);
        }

        setJobs(revived);
        jobsRef.current = revived;
      } catch (err) {
        console.error('ClipUploadQueue hydrate:', err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current || !hydrated) return;

    const pending = jobsRef.current.find(
      (j) =>
        (j.status === 'queued' || j.status === 'paused') &&
        (j.blobsReady || j.uploadMethod === 'url'),
    );
    if (!pending) return;

    if (pending.uploadMethod !== 'url') {
      const blobs = await resolveOutboxBlobs(pending.id);
      if (!blobs?.video) {
        updateJob(pending.id, {
          status: 'failed',
          blobsReady: false,
          error:
            'Clip video is not on this device anymore. Record and post again if needed.',
        });
        return;
      }
    }

    processingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    await acquireUploadWakeLock();

    updateJob(pending.id, {
      status: 'uploading',
      error: null,
      progress: pending.progress || 0,
    });

    try {
      await runOutboxJob(
        jobsRef.current.find((j) => j.id === pending.id) ?? pending,
        (patch) => updateJob(pending.id, patch),
        controller.signal,
      );
      updateJob(pending.id, { status: 'published', progress: 100 });
      removeJobLater(pending.id);
    } catch (err) {
      const message = formatUploadError(err);
      updateJob(pending.id, {
        status: isRetryableUploadError(message) ? 'paused' : 'failed',
        error: message,
      });
    } finally {
      await releaseUploadWakeLock();
      processingRef.current = false;
      abortRef.current = null;
      queueMicrotask(() => {
        void processNext();
      });
    }
  }, [hydrated, removeJobLater, updateJob]);

  useEffect(() => {
    if (!hydrated) return;
    queueMicrotask(() => {
      void processNext();
    });
  }, [hydrated, processNext]);

  const resumeRetryableJobs = useCallback(
    (preserveProgress = true) => {
      const retryable = jobsRef.current.filter(
        (j) =>
          j.blobsReady &&
          (j.status === 'paused' ||
            (j.status === 'failed' && isRetryableUploadError(j.error))),
      );
      if (retryable.length === 0) return;

      setJobs((prev) => {
        const next = prev.map((j) => {
          const shouldRetry =
            j.blobsReady &&
            (j.status === 'paused' ||
              (j.status === 'failed' && isRetryableUploadError(j.error)));
          if (!shouldRetry) return j;
          return {
            ...j,
            status: 'queued' as const,
            error: null,
            progress: preserveProgress ? j.progress : 0,
          };
        });
        jobsRef.current = next;
        void persist(next);
        return next;
      });

      queueMicrotask(() => {
        void processNext();
      });
    },
    [persist, processNext],
  );

  useEffect(() => {
    if (!hydrated) return;

    const onOnline = () => resumeRetryableJobs(true);

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [hydrated, resumeRetryableJobs]);

  useEffect(() => {
    if (!hydrated) return;

    const interval = window.setInterval(() => {
      const hasPaused = jobsRef.current.some(
        (j) =>
          j.blobsReady &&
          (j.status === 'paused' ||
            (j.status === 'failed' && isRetryableUploadError(j.error))),
      );
      if (!hasPaused || processingRef.current) return;
      resumeRetryableJobs(true);
    }, PAUSED_RETRY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [hydrated, resumeRetryableJobs]);

  useEffect(() => {
    if (!hydrated) return;

    const onPageShow = () => {
      queueMicrotask(() => {
        void processNext();
      });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [hydrated, processNext]);

  useEffect(() => bindUploadWakeLockVisibility(), []);

  const enqueue = useCallback(
    (payload: ClipUploadJobPayload, previewObjectUrl?: string | null): string | null => {
      const active = jobsRef.current.filter(
        (j) => j.status !== 'published' && j.status !== 'failed',
      );
      if (active.length >= MAX_QUEUE_SIZE) {
        return null;
      }

      const blob = payload.videoBlob;
      const file = payload.videoFile;
      const isUrlJob = payload.uploadMethod === 'url' && Boolean(payload.videoUrl?.trim());
      if (!blob && !file && !isUrlJob) return null;

      const job = jobFromPayload(payload, previewObjectUrl);

      setJobs((prev) => {
        const next = [...prev, job];
        jobsRef.current = next;
        void persist(next);
        return next;
      });

      if (isUrlJob) {
        updateJob(job.id, { blobsReady: true });
        void processNext();
        return job.id;
      }

      const videoBlob = blob ?? file!;

      void (async () => {
        try {
          await persistOutboxVideo(
            job.id,
            videoBlob instanceof File ? videoBlob : videoBlob,
            payload.thumbnailFile ?? null,
          );
          const gallery = await saveClipToDeviceGallery(
            videoBlob instanceof File ? videoBlob : videoBlob,
            job.fileName,
          );
          updateJob(job.id, { blobsReady: true, savedToDevice: gallery.saved });
          scheduleNativeBackgroundUpload(job.id, gallery.nativeCachePath);
          void processNext();

          let thumb = payload.thumbnailFile ?? null;
          if (!thumb) {
            thumb = await generateVideoThumbnailJpeg(videoBlob, {
              maxWidth: 640,
              quality: 0.82,
            });
          }
          if (thumb) {
            await persistOutboxThumbnail(job.id, thumb);
          }
        } catch (err) {
          console.error('ClipUploadQueue persist:', err);
          updateJob(job.id, {
            status: 'failed',
            blobsReady: false,
            error: 'Could not save clip on this device. Try again.',
          });
        }
      })();

      return job.id;
    },
    [persist, processNext, updateJob],
  );

  const retryJob = useCallback(
    (id: string) => {
      void (async () => {
        const job = jobsRef.current.find((j) => j.id === id);
        if (job?.uploadMethod !== 'url') {
          const blobs = await resolveOutboxBlobs(id);
          if (!blobs?.video) {
            updateJob(id, {
              status: 'failed',
              blobsReady: false,
              error:
                'Clip video is not on this device anymore. Record and post again if needed.',
            });
            return;
          }
        }
        updateJob(id, {
          status: 'queued',
          blobsReady: true,
          error: null,
          progress: jobsRef.current.find((j) => j.id === id)?.progress ?? 0,
        });
        queueMicrotask(() => {
          void processNext();
        });
      })();
    },
    [processNext, updateJob],
  );

  const dismissJob = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      clearCachedOutboxBlobs(id);
      await deleteOutboxJob(id);
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== id);
        jobsRef.current = next;
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const activeCount = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === 'queued' ||
          j.status === 'classifying' ||
          j.status === 'uploading' ||
          j.status === 'completing' ||
          j.status === 'processing' ||
          j.status === 'paused',
      ).length,
    [jobs],
  );

  const value = useMemo(
    () => ({
      jobs,
      activeCount,
      enqueue,
      retryJob,
      dismissJob,
    }),
    [jobs, activeCount, enqueue, retryJob, dismissJob],
  );

  return <ClipUploadQueueContext.Provider value={value}>{children}</ClipUploadQueueContext.Provider>;
}

export function useClipUploadQueue(): ClipUploadQueueValue {
  const ctx = useContext(ClipUploadQueueContext);
  if (!ctx) {
    return {
      jobs: [],
      activeCount: 0,
      enqueue: () => null,
      retryJob: () => {},
      dismissJob: () => {},
    };
  }
  return ctx;
}
