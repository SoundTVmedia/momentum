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
  cacheOutboxBlobs,
  clearCachedOutboxBlobs,
  formatUploadError,
  isRetryableUploadError,
  persistOutboxVideo,
  resolveOutboxBlobs,
  waitForOutboxBlobs,
} from '@/react-app/lib/upload-outbox/blob-store';
import {
  isRecoverableSaveError,
  registerClipBlob,
  releaseClipBlob,
} from '@/react-app/lib/upload-outbox/clip-blob-registry';
import { PENDING_CAPTURE_JOB_ID } from '@/react-app/lib/upload-outbox/capture-local-save';
import {
  deleteOutboxJob,
  loadOutboxMeta,
  saveOutboxMeta,
} from '@/react-app/lib/upload-outbox/idb';
import { jobFromPayload, runOutboxJob } from '@/react-app/lib/upload-outbox/runner';
import type { PersistedOutboxMeta, UploadOutboxJob } from '@/react-app/lib/upload-outbox/types';
import { persistClipInBackground } from '@/react-app/lib/upload-outbox/background-persist';
import { isNetworkAvailable } from '@/react-app/lib/upload-outbox/network-utils';
import {
  acquireUploadWakeLock,
  bindUploadWakeLockVisibility,
  releaseUploadWakeLock,
} from '@/react-app/lib/upload-outbox/upload-wake-lock';

const MAX_QUEUE_SIZE = 5;
const DONE_TTL_MS = 8000;
const AUTO_RETRY_BASE_MS = 3_000;
const AUTO_RETRY_MAX_MS = 60_000;
const UPLOAD_STALL_MS = 180_000;
const PROCESSING_WATCHDOG_MS = 600_000;
const QUEUE_POLL_MS = 10_000;
const BLOB_WAIT_FAIL_MS = 30 * 60 * 1000;

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
    gallerySaved: meta.gallerySaved ?? false,
    videoFile: null,
    videoBlob: null,
    thumbnailFile: null,
    captureAudioBlob: null,
  };
}

function jobIsReadyToUpload(job: UploadOutboxJob): boolean {
  if (job.uploadMethod === 'url') return Boolean(job.blobsReady);
  return Boolean(job.blobsReady);
}

export function ClipUploadQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ClipUploadQueueJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoRetryTimersRef = useRef<Map<string, number>>(new Map());
  const processNextRef = useRef<() => void>(() => {});
  const abortForStallRef = useRef(false);
  const processingStartedAtRef = useRef<number | null>(null);

  const clearAutoRetryTimer = useCallback((jobId: string) => {
    const t = autoRetryTimersRef.current.get(jobId);
    if (t != null) {
      window.clearTimeout(t);
      autoRetryTimersRef.current.delete(jobId);
    }
  }, []);

  const persist = useCallback(async (next: ClipUploadQueueJob[]) => {
    const active = next.filter((j) => j.status !== 'published');
    try {
      await saveOutboxMeta(active.map(toPersisted));
    } catch (err) {
      console.warn('ClipUploadQueue saveOutboxMeta:', err);
    }
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

          const blobs = await resolveOutboxBlobs(job.id);
          if (blobs?.video) {
            registerClipBlob(job.id, blobs.video);
            job = {
              ...job,
              blobsReady: true,
              gallerySaved: true,
              status: job.status === 'failed' ? 'queued' : job.status,
              error: null,
            };
          } else if (job.uploadMethod === 'url' && job.videoUrl?.trim()) {
            job = { ...job, blobsReady: true, gallerySaved: true };
          } else {
            const pending = await resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID);
            if (pending?.video) {
              registerClipBlob(job.id, pending.video);
              cacheOutboxBlobs(job.id, pending);
              void persistOutboxVideo(job.id, pending.video, pending.thumbnail ?? null);
              job = { ...job, blobsReady: true, status: 'queued', error: null };
            } else if (
              job.blobsReady ||
              isRecoverableSaveError(job.error) ||
              Date.now() - job.createdAt < BLOB_WAIT_FAIL_MS
            ) {
              job = {
                ...job,
                blobsReady: true,
                status: 'queued',
                error: null,
              };
            } else if (job.status === 'queued' || job.status === 'failed') {
              job = {
                ...job,
                blobsReady: false,
                status: 'failed',
                error:
                  'Clip video is not on this device anymore. Record and post again if needed.',
              };
            }
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
      (j) => (j.status === 'queued' || j.status === 'paused') && jobIsReadyToUpload(j),
    );
    if (!pending) return;

    if (!isNetworkAvailable()) {
      if (pending.status === 'uploading') {
        updateJob(pending.id, {
          status: 'paused',
          error:
            "You're offline. Your clip is saved on this device — upload will continue when you're back online.",
        });
      }
      return;
    }

    if (pending.uploadMethod !== 'url') {
      const blobs = await waitForOutboxBlobs(pending.id);
      if (!blobs?.video) {
        updateJob(pending.id, {
          status: 'paused',
          blobsReady: true,
          error: 'Your clip is saved — upload will start shortly.',
        });
        clearAutoRetryTimer(pending.id);
        const timer = window.setTimeout(() => {
          autoRetryTimersRef.current.delete(pending.id);
          updateJob(pending.id, { status: 'queued', error: null });
          queueMicrotask(() => processNextRef.current());
        }, 2_000);
        autoRetryTimersRef.current.set(pending.id, timer);
        return;
      }
    }

    processingRef.current = true;
    processingStartedAtRef.current = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    await acquireUploadWakeLock();

    updateJob(pending.id, {
      status: 'uploading',
      error: null,
      progress: pending.progress || 0,
    });

    let lastActivityAt = Date.now();
    let lastProgressValue = pending.progress || 0;
    const stallTimer = window.setInterval(() => {
      if (Date.now() - lastActivityAt < UPLOAD_STALL_MS) return;
      abortForStallRef.current = true;
      controller.abort();
    }, 5_000);
    const progressHeartbeat = window.setInterval(() => {
      const current = jobsRef.current.find((j) => j.id === pending.id);
      if (!current) return;
      if (
        current.status === 'uploading' ||
        current.status === 'classifying' ||
        current.status === 'completing' ||
        current.status === 'processing'
      ) {
        lastActivityAt = Date.now();
      }
    }, 15_000);

    try {
      await runOutboxJob(
        jobsRef.current.find((j) => j.id === pending.id) ?? pending,
        (patch) => {
          lastActivityAt = Date.now();
          if (patch.progress != null && patch.progress > lastProgressValue) {
            lastProgressValue = patch.progress;
          }
          updateJob(pending.id, patch);
        },
        controller.signal,
      );
      updateJob(pending.id, { status: 'published', progress: 100 });
      clearAutoRetryTimer(pending.id);
      releaseClipBlob(pending.id);
      removeJobLater(pending.id);
    } catch (err) {
      let message = formatUploadError(err);
      if (abortForStallRef.current) {
        abortForStallRef.current = false;
        message =
          'Slow connection — your clip is saved on this device. Upload will continue when the connection improves.';
      }
      const current = jobsRef.current.find((j) => j.id === pending.id);
      const retryCount = (current?.uploadRetryCount ?? 0) + 1;
      if (isRetryableUploadError(message) || isRecoverableSaveError(message)) {
        updateJob(pending.id, {
          status: 'paused',
          error: message,
          uploadRetryCount: retryCount,
        });
        clearAutoRetryTimer(pending.id);
        const delay = Math.min(
          AUTO_RETRY_MAX_MS,
          AUTO_RETRY_BASE_MS * 2 ** Math.max(0, retryCount - 1),
        );
        const timer = window.setTimeout(() => {
          autoRetryTimersRef.current.delete(pending.id);
          const job = jobsRef.current.find((j) => j.id === pending.id);
          if (!job || job.status !== 'paused') return;
          updateJob(pending.id, { status: 'queued', error: null });
          queueMicrotask(() => processNextRef.current());
        }, delay);
        autoRetryTimersRef.current.set(pending.id, timer);
      } else {
        clearAutoRetryTimer(pending.id);
        updateJob(pending.id, { status: 'failed', error: message });
      }
    } finally {
      window.clearInterval(stallTimer);
      window.clearInterval(progressHeartbeat);
      await releaseUploadWakeLock();
      processingRef.current = false;
      processingStartedAtRef.current = null;
      abortRef.current = null;
      queueMicrotask(() => {
        void processNext();
      });
    }
  }, [clearAutoRetryTimer, hydrated, removeJobLater, updateJob]);

  processNextRef.current = () => {
    void processNext();
  };

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
          jobIsReadyToUpload(j) &&
          (j.status === 'paused' ||
            j.status === 'queued' ||
            (j.status === 'failed' &&
              (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error)))),
      );
      if (retryable.length === 0) return;

      setJobs((prev) => {
        const next = prev.map((j) => {
          const shouldRetry =
            jobIsReadyToUpload(j) &&
            (j.status === 'paused' ||
              j.status === 'queued' ||
              (j.status === 'failed' &&
                (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error))));
          if (!shouldRetry) return j;
          if (j.status === 'queued') return j;
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

    const onOnline = () => {
      resumeRetryableJobs(true);
      queueMicrotask(() => {
        void processNext();
      });
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [hydrated, resumeRetryableJobs]);

  useEffect(() => {
    if (!hydrated) return;

    const interval = window.setInterval(() => {
      if (!isNetworkAvailable()) return;
      const hasWork = jobsRef.current.some(
        (j) =>
          jobIsReadyToUpload(j) &&
          (j.status === 'queued' ||
            j.status === 'paused' ||
            (j.status === 'failed' &&
              (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error)))),
      );
      if (!hasWork || processingRef.current) return;
      resumeRetryableJobs(true);
      void processNext();
    }, QUEUE_POLL_MS);

    return () => window.clearInterval(interval);
  }, [hydrated, processNext, resumeRetryableJobs]);

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

  /** Recover if a upload handler never finishes (hung fetch, crashed tab, etc.). */
  useEffect(() => {
    if (!hydrated) return;

    const interval = window.setInterval(() => {
      if (!processingRef.current || processingStartedAtRef.current == null) return;
      if (Date.now() - processingStartedAtRef.current < PROCESSING_WATCHDOG_MS) return;

      console.warn('ClipUploadQueue: processing watchdog — resetting stuck upload');
      abortForStallRef.current = true;
      abortRef.current?.abort();
      processingRef.current = false;
      processingStartedAtRef.current = null;

      const stuck = jobsRef.current.find(
        (j) =>
          j.status === 'uploading' ||
          j.status === 'classifying' ||
          j.status === 'completing' ||
          j.status === 'processing',
      );
      if (stuck) {
        updateJob(stuck.id, {
          status: 'paused',
          error:
            'Slow connection — your clip is saved on this device. Upload will continue when the connection improves.',
        });
      }

      queueMicrotask(() => {
        void processNext();
      });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [hydrated, processNext, updateJob]);

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

      if (isUrlJob) {
        setJobs((prev) => {
          const next = [...prev, job];
          jobsRef.current = next;
          void persist(next);
          return next;
        });
        updateJob(job.id, { blobsReady: true, gallerySaved: true });
        void processNext();
        return job.id;
      }

      const videoBlob = blob ?? file!;
      if (videoBlob.size <= 0) {
        return null;
      }

      registerClipBlob(job.id, videoBlob);
      cacheOutboxBlobs(job.id, {
        video: videoBlob,
        thumbnail: payload.thumbnailFile ?? null,
      });

      const readyJob: UploadOutboxJob = {
        ...job,
        blobsReady: true,
        status: 'queued',
        error: null,
      };

      setJobs((prev) => {
        const next = [...prev, readyJob];
        jobsRef.current = next;
        void persist(next);
        return next;
      });

      void processNext();

      void persistClipInBackground({
        jobId: job.id,
        video: videoBlob,
        fileName: job.fileName,
        thumbnailFile: payload.thumbnailFile,
        onGallerySaved: (saved) => {
          updateJob(job.id, { gallerySaved: true, savedToDevice: saved });
        },
      });

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
      clearAutoRetryTimer(id);
      abortRef.current?.abort();
      clearCachedOutboxBlobs(id);
      releaseClipBlob(id);
      await deleteOutboxJob(id);
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== id);
        jobsRef.current = next;
        void persist(next);
        return next;
      });
    },
    [clearAutoRetryTimer, persist],
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
