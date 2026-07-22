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
import { useAuth } from '@getmocha/users-service/react';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import {
  cacheOutboxBlobs,
  formatUploadError,
  isBlobWaitPauseError,
  isRetryableUploadError,
  peekCachedOutboxBlobs,
  persistOutboxVideo,
  resolveOutboxBlobs,
  waitForOutboxBlobs,
} from '@/react-app/lib/upload-outbox/blob-store';
import { isUploadFinishedOnServer } from '@/react-app/lib/upload-outbox/multipart-upload';
import { uploadFetch } from '@/react-app/lib/upload-outbox/upload-fetch';
import {
  isRecoverableSaveError,
  registerClipBlob,
  releaseClipBlob,
} from '@/react-app/lib/upload-outbox/clip-blob-registry';
import {
  PENDING_CAPTURE_JOB_ID,
  clearPendingCapture,
  clearPendingCaptureMemory,
  invalidatePendingCaptureFlush,
} from '@/react-app/lib/upload-outbox/capture-local-save';
import { markCaptureSharedForBlob, blockCaptureReviewRecovery, isActiveCaptureHandoff } from '@/react-app/lib/upload-outbox/capture-handoff';
import { clearCaptionDraft } from '@/react-app/lib/upload-outbox/caption-draft';
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
import { notifyClipUploadSuccess } from '@/react-app/lib/upload-outbox/upload-success-notification';
import { resolveWelcomeName } from '@/react-app/lib/resolveWelcomeName';
import type { ExtendedMochaUser } from '@/shared/types';

const MAX_QUEUE_SIZE = 5;
const DONE_TTL_MS = 8000;
const AUTO_RETRY_BASE_MS = 5_000;
const AUTO_RETRY_MAX_MS = 120_000;
const UPLOAD_STALL_MS = 180_000;
const PROCESSING_WATCHDOG_MS = 600_000;
const QUEUE_POLL_MS = 10_000;
const BLOB_WAIT_AFTER_REFRESH_MS = 45_000;
const BLOB_WAIT_POLL_MS = 500;
const BLOB_WAIT_MAX_ATTEMPTS = 90;

export type ClipUploadQueueJob = UploadOutboxJob;

type EnqueueClipOptions = {
  /** Native capture file URI — prefer Photos save from this path (skip blob rewrite). */
  nativeVideoUri?: string | null;
};

type ClipUploadQueueValue = {
  jobs: ClipUploadQueueJob[];
  activeCount: number;
  enqueue: (
    payload: ClipUploadJobPayload,
    previewObjectUrl?: string | null,
    opts?: EnqueueClipOptions,
  ) => string | null;
  restartJob: (id: string) => void;
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
  if (job.uploadMethod === 'url') {
    return Boolean(job.videoUrl?.trim()) || Boolean(job.blobsReady);
  }
  return Boolean(job.blobsReady || job.sessionId?.trim());
}

function scheduleAutoRetry(
  jobId: string,
  delayMs: number,
  refs: {
    autoRetryTimers: React.MutableRefObject<Map<string, number>>;
    jobs: React.MutableRefObject<ClipUploadQueueJob[]>;
    processNext: React.MutableRefObject<() => void>;
  },
  clearAutoRetryTimer: (id: string) => void,
  updateJob: (id: string, patch: Partial<ClipUploadQueueJob>) => void,
): void {
  clearAutoRetryTimer(jobId);
  const timer = window.setTimeout(() => {
    refs.autoRetryTimers.current.delete(jobId);
    const job = refs.jobs.current.find((j) => j.id === jobId);
    if (!job || job.status !== 'paused') return;
    updateJob(jobId, { status: 'queued', error: null });
    queueMicrotask(() => refs.processNext.current());
  }, delayMs);
  refs.autoRetryTimers.current.set(jobId, timer);
}

async function hydrateJobFromStorage(meta: PersistedOutboxMeta): Promise<UploadOutboxJob> {
  let job = reviveJob(meta);
  if (
    job.status === 'uploading' ||
    job.status === 'completing' ||
    job.status === 'classifying' ||
    job.status === 'processing'
  ) {
    job = { ...job, status: 'queued' };
  }

  const blobs = await resolveOutboxBlobs(job.id);
  if (blobs?.video) {
    registerClipBlob(job.id, blobs.video);
    return {
      ...job,
      blobsReady: true,
      gallerySaved: true,
      captureAudioBlob: blobs.captureAudio ?? job.captureAudioBlob ?? null,
      status: job.status === 'failed' ? 'queued' : job.status,
      error: null,
    };
  }

  if (job.uploadMethod === 'url' && job.videoUrl?.trim()) {
    return { ...job, blobsReady: true, gallerySaved: true };
  }

  const pending = await resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  if (pending?.video) {
    registerClipBlob(job.id, pending.video);
    cacheOutboxBlobs(job.id, pending);
    void persistOutboxVideo(job.id, pending.video, pending.thumbnail ?? null, pending.captureAudio ?? null);
    clearPendingCaptureMemory();
    void deleteOutboxJob(PENDING_CAPTURE_JOB_ID).catch(() => {
      /* ignore */
    });
    return { ...job, blobsReady: true, status: 'queued', error: null };
  }

  if (job.sessionId?.trim()) {
    try {
      const res = await uploadFetch(`/api/uploads/${job.sessionId}/status`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          uploadStatus?: string;
          clipPublished?: boolean;
        };
        if (isUploadFinishedOnServer(data.uploadStatus, data.clipPublished)) {
          await deleteOutboxJob(job.id);
          return { ...job, status: 'published', progress: 100, blobsReady: true, error: null };
        }
      }
    } catch {
      /* session may be invalid — resume with blob when available */
    }
  }

  if (Date.now() - job.createdAt < BLOB_WAIT_AFTER_REFRESH_MS) {
    return {
      ...job,
      blobsReady: false,
      status: 'paused',
      error: 'Waiting for video on this device — upload will start shortly.',
    };
  }

  if (
    job.status === 'failed' &&
    (isRetryableUploadError(job.error) || isRecoverableSaveError(job.error))
  ) {
    return { ...job, status: 'queued', error: null };
  }

  return {
    ...job,
    blobsReady: false,
    status: 'failed',
    error: 'Clip video is not on this device anymore. Record and post again if needed.',
  };
}

/** FIFO: one clip at a time; paused jobs wait for their retry timer. */
function nextUploadJob(jobs: UploadOutboxJob[]): UploadOutboxJob | undefined {
  const sorted = [...jobs].sort((a, b) => a.createdAt - b.createdAt);
  for (const j of sorted) {
    if (j.status === 'published') continue;
    if (j.status === 'failed') {
      continue;
    }
    if (
      j.status === 'uploading' ||
      j.status === 'classifying' ||
      j.status === 'completing' ||
      j.status === 'processing' ||
      j.status === 'paused'
    ) {
      return undefined;
    }
    if (j.status === 'queued' && jobIsReadyToUpload(j)) {
      return j;
    }
  }
  return undefined;
}

export function ClipUploadQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const welcomeName = resolveWelcomeName(user as ExtendedMochaUser | null);
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
  const notifiedPublishedRef = useRef<Set<string>>(new Set());

  const notifyPublishedIfNeeded = useCallback(
    (job: ClipUploadQueueJob) => {
      if (notifiedPublishedRef.current.has(job.id)) return;
      notifiedPublishedRef.current.add(job.id);
      const publishedVideo = peekCachedOutboxBlobs(job.id)?.video;
      if (publishedVideo?.size) {
        markCaptureSharedForBlob(publishedVideo);
      }
      void notifyClipUploadSuccess(welcomeName);
      // Earlier clips finishing upload must not wipe a newer in-progress capture session.
      if (isActiveCaptureHandoff()) return;
      blockCaptureReviewRecovery();
      void clearPendingCapture({ force: true });
      void clearCaptionDraft();
    },
    [welcomeName],
  );

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

        const revivedJobs: UploadOutboxJob[] = [];
        for (const m of meta) {
          const job = await hydrateJobFromStorage(m);
          if (job.status === 'published') {
            notifiedPublishedRef.current.add(job.id);
          }
          revivedJobs.push(job);
        }

        setJobs(revivedJobs);
        jobsRef.current = revivedJobs;
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

    const pending = nextUploadJob(jobsRef.current);
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

    processingRef.current = true;
    try {
      if (pending.uploadMethod !== 'url') {
        const blobs = await waitForOutboxBlobs(pending.id, {
          attempts: BLOB_WAIT_MAX_ATTEMPTS,
          delayMs: BLOB_WAIT_POLL_MS,
        });
        if (!blobs?.video && !pending.sessionId?.trim()) {
          updateJob(pending.id, {
            status: 'paused',
            blobsReady: false,
            error: 'Waiting for video on this device — upload will start shortly.',
          });
          scheduleAutoRetry(
            pending.id,
            8_000,
            {
              autoRetryTimers: autoRetryTimersRef,
              jobs: jobsRef,
              processNext: processNextRef,
            },
            clearAutoRetryTimer,
            updateJob,
          );
          return;
        }
        if (blobs?.video) {
          registerClipBlob(pending.id, blobs.video);
          updateJob(pending.id, { blobsReady: true });
        }
      }

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
            if (patch.status === 'published') {
              updateJob(pending.id, { ...patch, blobsReady: true });
              notifyPublishedIfNeeded({ ...pending, ...patch, blobsReady: true });
              return;
            }
            updateJob(pending.id, patch);
          },
          controller.signal,
        );
        updateJob(pending.id, { status: 'published', progress: 100 });
        notifyPublishedIfNeeded(
          jobsRef.current.find((j) => j.id === pending.id) ?? { ...pending, status: 'published', progress: 100 },
        );
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
          const delay = Math.min(
            AUTO_RETRY_MAX_MS,
            AUTO_RETRY_BASE_MS * 2 ** Math.max(0, retryCount - 1),
          );
          scheduleAutoRetry(
            pending.id,
            delay,
            {
              autoRetryTimers: autoRetryTimersRef,
              jobs: jobsRef,
              processNext: processNextRef,
            },
            clearAutoRetryTimer,
            updateJob,
          );
        } else {
          clearAutoRetryTimer(pending.id);
          updateJob(pending.id, { status: 'failed', error: message });
        }
      } finally {
        window.clearInterval(stallTimer);
        window.clearInterval(progressHeartbeat);
        await releaseUploadWakeLock();
        processingStartedAtRef.current = null;
        abortRef.current = null;
        const jobAfterRun = jobsRef.current.find((j) => j.id === pending.id);
        if (jobAfterRun?.status !== 'paused') {
          queueMicrotask(() => {
            void processNext();
          });
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [clearAutoRetryTimer, hydrated, notifyPublishedIfNeeded, removeJobLater, updateJob]);

  processNextRef.current = () => {
    void processNext();
  };

  const resumeRetryableJobs = useCallback(
    (preserveProgress = true) => {
      const retryable = jobsRef.current.filter(
        (j) =>
          jobIsReadyToUpload(j) &&
          j.status === 'failed' &&
          (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error)),
      );
      if (retryable.length === 0) return;

      setJobs((prev) => {
        const next = prev.map((j) => {
          const shouldRetry =
            jobIsReadyToUpload(j) &&
            j.status === 'failed' &&
            (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error));
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

  const reattemptPausedBlobJobs = useCallback(async () => {
    let changed = false;
    for (const j of jobsRef.current) {
      if (j.status !== 'paused' || !isBlobWaitPauseError(j.error)) continue;
      const blobs = await resolveOutboxBlobs(j.id);
      if (!blobs?.video) continue;
      registerClipBlob(j.id, blobs.video);
      updateJob(j.id, { blobsReady: true, status: 'queued', error: null });
      changed = true;
    }
    if (changed) {
      queueMicrotask(() => {
        void processNext();
      });
    }
  }, [processNext, updateJob]);

  useEffect(() => {
    if (!hydrated) return;

    for (const j of jobsRef.current) {
      if (
        j.status === 'paused' &&
        isBlobWaitPauseError(j.error) &&
        !autoRetryTimersRef.current.has(j.id)
      ) {
        scheduleAutoRetry(
          j.id,
          5_000,
          {
            autoRetryTimers: autoRetryTimersRef,
            jobs: jobsRef,
            processNext: processNextRef,
          },
          clearAutoRetryTimer,
          updateJob,
        );
      }
    }

    void reattemptPausedBlobJobs();
    resumeRetryableJobs(true);
    queueMicrotask(() => {
      void processNext();
    });
  }, [clearAutoRetryTimer, hydrated, processNext, reattemptPausedBlobJobs, resumeRetryableJobs, updateJob]);

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

      for (const j of jobsRef.current) {
        if (j.status === 'paused' && !autoRetryTimersRef.current.has(j.id)) {
          if (isBlobWaitPauseError(j.error)) continue;
          updateJob(j.id, { status: 'queued', error: null });
        }
      }

      const hasWork = jobsRef.current.some(
        (j) =>
          jobIsReadyToUpload(j) &&
          (j.status === 'queued' ||
            (j.status === 'failed' &&
              (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error)))),
      );
      if (!hasWork || processingRef.current) return;
      resumeRetryableJobs(true);
      void processNext();
    }, QUEUE_POLL_MS);

    return () => window.clearInterval(interval);
  }, [hydrated, processNext, resumeRetryableJobs, updateJob]);

  useEffect(() => {
    if (!hydrated) return;

    const onPageShow = () => {
      void reattemptPausedBlobJobs();
      resumeRetryableJobs(true);
      queueMicrotask(() => {
        void processNext();
      });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [hydrated, processNext, reattemptPausedBlobJobs, resumeRetryableJobs]);

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
        scheduleAutoRetry(
          stuck.id,
          AUTO_RETRY_BASE_MS,
          {
            autoRetryTimers: autoRetryTimersRef,
            jobs: jobsRef,
            processNext: processNextRef,
          },
          clearAutoRetryTimer,
          updateJob,
        );
      }

      queueMicrotask(() => {
        void processNext();
      });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [clearAutoRetryTimer, hydrated, processNext, updateJob]);

  const enqueue = useCallback(
    (
      payload: ClipUploadJobPayload,
      previewObjectUrl?: string | null,
      opts?: EnqueueClipOptions,
    ): string | null => {
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
      markCaptureSharedForBlob(videoBlob);
      blockCaptureReviewRecovery();
      invalidatePendingCaptureFlush();
      clearPendingCaptureMemory({ force: true });
      void deleteOutboxJob(PENDING_CAPTURE_JOB_ID).catch((err) => {
        console.warn('ClipUploadQueue delete pending capture:', err);
      });
      cacheOutboxBlobs(job.id, {
        video: videoBlob,
        thumbnail: payload.thumbnailFile ?? null,
        captureAudio: payload.captureAudioBlob ?? null,
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

      queueMicrotask(() => {
        void processNext();
      });

      const nativeVideoUri = opts?.nativeVideoUri?.trim() || undefined;

      void (async () => {
        try {
          await persistOutboxVideo(
            job.id,
            videoBlob,
            payload.thumbnailFile ?? null,
            payload.captureAudioBlob ?? null,
          );
        } catch (err) {
          console.warn('ClipUploadQueue persistOutboxVideo:', err);
        }
        await clearPendingCapture();
        void persistClipInBackground({
          jobId: job.id,
          video: videoBlob,
          fileName: job.fileName,
          thumbnailFile: payload.thumbnailFile,
          nativeVideoUri,
          onGallerySaved: (saved) => {
            updateJob(job.id, { gallerySaved: true, savedToDevice: saved });
          },
        });
      })();

      return job.id;
    },
    [persist, processNext, updateJob],
  );

  const restartJob = useCallback(
    (id: string) => {
      void (async () => {
        clearAutoRetryTimer(id);
        const job = jobsRef.current.find((j) => j.id === id);
        if (!job) return;

        const activeOnJob =
          job.status === 'uploading' ||
          job.status === 'classifying' ||
          job.status === 'completing' ||
          job.status === 'processing';
        if (processingRef.current && activeOnJob) {
          abortForStallRef.current = false;
          abortRef.current?.abort();
          processingRef.current = false;
          processingStartedAtRef.current = null;
        }

        if (job.uploadMethod !== 'url') {
          let blobs = await resolveOutboxBlobs(id);
          if (!blobs?.video) {
            const pending = await resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID);
            if (pending?.video) {
              registerClipBlob(id, pending.video);
              cacheOutboxBlobs(id, pending);
              blobs = pending;
              clearPendingCaptureMemory();
              void deleteOutboxJob(PENDING_CAPTURE_JOB_ID).catch(() => {
                /* ignore */
              });
            }
          }
          if (!blobs?.video) {
            updateJob(id, {
              status: 'failed',
              blobsReady: false,
              error:
                'Clip video is not on this device anymore. Record and post again if needed.',
            });
            return;
          }
          registerClipBlob(id, blobs.video);
        }

        updateJob(id, {
          status: 'queued',
          blobsReady: true,
          error: null,
          progress: 0,
          uploadRetryCount: 0,
          sessionId: null,
          clipId: null,
          uploadMode: null,
          partUrls: null,
        });
        queueMicrotask(() => {
          void processNext();
        });
      })();
    },
    [clearAutoRetryTimer, processNext, updateJob],
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
      restartJob,
    }),
    [jobs, activeCount, enqueue, restartJob],
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
      restartJob: () => {},
    };
  }
  return ctx;
}
