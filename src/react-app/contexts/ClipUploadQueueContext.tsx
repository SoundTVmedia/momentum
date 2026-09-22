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
import { App } from '@capacitor/app';
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
import {
  getNetworkReachability,
  initUploadReachability,
  subscribeReachability,
} from '@/react-app/lib/upload-outbox/network-utils';
import {
  loadNativeOutboxMeta,
  nativeOutboxFileExists,
  persistDurableVideoFile,
  persistNativeOutboxMeta,
  recoverDurableVideoPath,
} from '@/react-app/lib/upload-outbox/native-outbox';
import {
  delayMsForUploadAttempt,
  UPLOAD_RETRY_CONFIG,
} from '@/react-app/lib/upload-outbox/upload-retry-config';
import {
  acquireUploadWakeLock,
  bindUploadWakeLockVisibility,
  releaseUploadWakeLock,
} from '@/react-app/lib/upload-outbox/upload-wake-lock';
import { notifyClipUploadSuccess } from '@/react-app/lib/upload-outbox/upload-success-notification';
import { isNativeApp, writeVideoToNativeCache } from '@/react-app/lib/native-bridge';
import { resolveWelcomeName } from '@/react-app/lib/resolveWelcomeName';
import type { ExtendedMochaUser } from '@/shared/types';

const MAX_QUEUE_SIZE = UPLOAD_RETRY_CONFIG.maxQueueSize;
const MAX_CONCURRENT_UPLOADS = UPLOAD_RETRY_CONFIG.maxConcurrentUploads;
const DONE_TTL_MS = 8000;
const UPLOAD_STALL_MS = 180_000;
const PROCESSING_WATCHDOG_MS = 600_000;
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
  if (job.uploadMethod === 'url') {
    return Boolean(job.videoUrl?.trim()) || Boolean(job.blobsReady);
  }
  return Boolean(job.blobsReady || job.sessionId?.trim() || job.nativeVideoUri?.trim());
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
    if (!job || (job.status !== 'paused' && job.status !== 'waiting' && job.status !== 'queued')) return;
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

  const nativePath = job.nativeVideoUri?.trim() || '';
  let nativeFileOk = nativePath ? await nativeOutboxFileExists(nativePath) : false;
  if (!nativeFileOk) {
    const recovered = await recoverDurableVideoPath(job.id, job.fileName);
    if (recovered) {
      job = { ...job, nativeVideoUri: recovered };
      nativeFileOk = true;
    }
  }

  const blobs = await resolveOutboxBlobs(job.id);
  if (blobs?.video) {
    registerClipBlob(job.id, blobs.video);
    return {
      ...job,
      blobsReady: true,
      gallerySaved: job.gallerySaved ?? true,
      captureAudioBlob: blobs.captureAudio ?? job.captureAudioBlob ?? null,
      status: job.status === 'failed' ? 'queued' : job.status,
      error: null,
    };
  }

  if (nativeFileOk) {
    return {
      ...job,
      blobsReady: true,
      nativeVideoUri: job.nativeVideoUri?.trim() || nativePath,
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

  // Keep the job. Never silently drop — the clip may still be in Photos.
  return {
    ...job,
    blobsReady: false,
    status: 'paused',
    error:
      'Waiting to restore this clip from the device. It is still in your queue — retry after the app finishes saving.',
  };
}

function isBlockingInFlightStatus(status: UploadOutboxJob['status']): boolean {
  return (
    status === 'uploading' ||
    status === 'classifying' ||
    status === 'completing' ||
    status === 'processing'
  );
}

/** Oldest first. Multiple jobs may upload at once up to MAX_CONCURRENT_UPLOADS. */
function nextUploadJobs(jobs: UploadOutboxJob[], inFlightCount: number): UploadOutboxJob[] {
  const slots = Math.max(0, MAX_CONCURRENT_UPLOADS - inFlightCount);
  if (slots <= 0) return [];
  const sorted = [...jobs].sort((a, b) => a.createdAt - b.createdAt);
  const picked: UploadOutboxJob[] = [];
  for (const j of sorted) {
    if (j.status === 'published' || j.status === 'failed' || j.status === 'paused') continue;
    if (j.status === 'waiting') continue;
    if (isBlockingInFlightStatus(j.status)) continue;
    if (j.status === 'queued' && jobIsReadyToUpload(j)) {
      picked.push(j);
      if (picked.length >= slots) break;
    }
  }
  return picked;
}

export function ClipUploadQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const welcomeName = resolveWelcomeName(user as ExtendedMochaUser | null);
  const [jobs, setJobs] = useState<ClipUploadQueueJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const processingIdsRef = useRef<Set<string>>(new Set());
  const abortByJobRef = useRef<Map<string, AbortController>>(new Map());
  const autoRetryTimersRef = useRef<Map<string, number>>(new Map());
  const processNextRef = useRef<() => void>(() => {});
  const abortForStallRef = useRef<Set<string>>(new Set());
  const processingStartedAtRef = useRef<Map<string, number>>(new Map());
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
      if (job.captureTimestampMissing && job.clipId != null && !isActiveCaptureHandoff()) {
        window.dispatchEvent(
          new CustomEvent('feedback:needs-show-picker', {
            detail: { jobId: job.id, clipId: job.clipId },
          }),
        );
      }
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
    const active = next.filter(
      (j) => j.status !== 'published' || Boolean(j.captureTimestampMissing),
    );
    try {
      await saveOutboxMeta(active.map(toPersisted));
    } catch (err) {
      console.warn('ClipUploadQueue saveOutboxMeta:', err);
    }
    void persistNativeOutboxMeta(active.map(toPersisted));
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
        const nativeMeta = await loadNativeOutboxMeta();
        if (cancelled) return;

        const merged = new Map<string, PersistedOutboxMeta>();
        for (const row of nativeMeta) merged.set(row.id, row);
        for (const row of meta) {
          const existing = merged.get(row.id);
          merged.set(row.id, existing ? { ...existing, ...row, nativeVideoUri: row.nativeVideoUri || existing.nativeVideoUri } : row);
        }

        const revivedJobs: UploadOutboxJob[] = [];
        for (const m of merged.values()) {
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
    if (!hydrated) return;

    const reachability = await getNetworkReachability();
    if (!reachability.connected) {
      const waitingIds: string[] = [];
      for (const j of jobsRef.current) {
        if (j.status === 'queued') {
          waitingIds.push(j.id);
        }
      }
      if (waitingIds.length > 0) {
        setJobs((prev) => {
          const next = prev.map((j) =>
            waitingIds.includes(j.id)
              ? {
                  ...j,
                  status: 'waiting' as const,
                  error: 'Waiting for connection',
                }
              : j,
          );
          jobsRef.current = next;
          void persist(next);
          return next;
        });
      }
      return;
    }

    const pendingList = nextUploadJobs(jobsRef.current, processingIdsRef.current.size);
    for (const pending of pendingList) {
      if (processingIdsRef.current.has(pending.id)) continue;
      processingIdsRef.current.add(pending.id);
      void runOneJob(pending);
    }

    async function runOneJob(pending: ClipUploadQueueJob) {
      try {
        if (pending.uploadMethod !== 'url' && !pending.nativeVideoUri?.trim()) {
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

        const stillOnline = await getNetworkReachability();
        if (!stillOnline.connected) {
          updateJob(pending.id, {
            status: 'waiting',
            error: 'Waiting for connection',
          });
          return;
        }

        processingStartedAtRef.current.set(pending.id, Date.now());
        const controller = new AbortController();
        abortByJobRef.current.set(pending.id, controller);

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
          abortForStallRef.current.add(pending.id);
          controller.abort();
        }, 5_000);
        const progressHeartbeat = window.setInterval(() => {
          const current = jobsRef.current.find((j) => j.id === pending.id);
          if (!current) return;
          if (isBlockingInFlightStatus(current.status)) {
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
            jobsRef.current.find((j) => j.id === pending.id) ?? {
              ...pending,
              status: 'published',
              progress: 100,
            },
          );
          clearAutoRetryTimer(pending.id);
          releaseClipBlob(pending.id);
          const finished = jobsRef.current.find((j) => j.id === pending.id);
          if (!finished?.captureTimestampMissing) {
            removeJobLater(pending.id);
          }
        } catch (err) {
          if (!jobsRef.current.some((j) => j.id === pending.id)) {
            return;
          }
          let message = formatUploadError(err);
          if (abortForStallRef.current.has(pending.id)) {
            abortForStallRef.current.delete(pending.id);
            message =
              'Slow connection — your clip is saved on this device. Upload will continue when the connection improves.';
          }
          const online = await getNetworkReachability();
          if (!online.connected) {
            updateJob(pending.id, {
              status: 'waiting',
              error: 'Waiting for connection',
            });
            return;
          }
          const current = jobsRef.current.find((j) => j.id === pending.id);
          const retryCount = (current?.uploadRetryCount ?? 0) + 1;
          if (isRetryableUploadError(message) || isRecoverableSaveError(message)) {
            updateJob(pending.id, {
              status: 'paused',
              error: message,
              uploadRetryCount: retryCount,
            });
            scheduleAutoRetry(
              pending.id,
              delayMsForUploadAttempt(retryCount),
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
          processingStartedAtRef.current.delete(pending.id);
          abortByJobRef.current.delete(pending.id);
          queueMicrotask(() => {
            void processNext();
          });
        }
      } finally {
        processingIdsRef.current.delete(pending.id);
      }
    }
  }, [clearAutoRetryTimer, hydrated, notifyPublishedIfNeeded, persist, removeJobLater, updateJob]);

  processNextRef.current = () => {
    void processNext();
  };

  const resumeRetryableJobs = useCallback(
    (preserveProgress = true) => {
      const retryable = jobsRef.current.filter(
        (j) =>
          jobIsReadyToUpload(j) &&
          (j.status === 'waiting' ||
            (j.status === 'failed' &&
              (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error)))),
      );
      if (retryable.length === 0) return;

      setJobs((prev) => {
        const next = prev.map((j) => {
          const shouldRetry =
            jobIsReadyToUpload(j) &&
            (j.status === 'waiting' ||
              (j.status === 'failed' &&
                (isRetryableUploadError(j.error) || isRecoverableSaveError(j.error))));
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
    const unsubReachability = subscribeReachability((status) => {
      if (!status.connected) return;
      onOnline();
    });
    return () => {
      window.removeEventListener('online', onOnline);
      unsubReachability();
    };
  }, [hydrated, processNext, resumeRetryableJobs]);

  useEffect(() => initUploadReachability(), []);

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
    let appHandle: { remove: () => Promise<void> } | undefined;
    void App.addListener('appStateChange', (state) => {
      if (!state.isActive) return;
      onPageShow();
    }).then((handle) => {
      appHandle = handle;
    });
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      void appHandle?.remove();
    };
  }, [hydrated, processNext, reattemptPausedBlobJobs, resumeRetryableJobs]);

  useEffect(() => bindUploadWakeLockVisibility(), []);

  /** Recover if an upload handler never finishes (hung fetch, crashed tab, etc.). */
  useEffect(() => {
    if (!hydrated) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      let resetAny = false;
      for (const [jobId, startedAt] of processingStartedAtRef.current) {
        if (now - startedAt < PROCESSING_WATCHDOG_MS) continue;
        console.warn('ClipUploadQueue: processing watchdog — resetting stuck upload', jobId);
        abortForStallRef.current.add(jobId);
        abortByJobRef.current.get(jobId)?.abort();
        processingIdsRef.current.delete(jobId);
        processingStartedAtRef.current.delete(jobId);
        updateJob(jobId, {
          status: 'paused',
          error:
            'Slow connection — your clip is saved on this device. Upload will continue when the connection improves.',
        });
        scheduleAutoRetry(
          jobId,
          delayMsForUploadAttempt(1),
          {
            autoRetryTimers: autoRetryTimersRef,
            jobs: jobsRef,
            processNext: processNextRef,
          },
          clearAutoRetryTimer,
          updateJob,
        );
        resetAny = true;
      }
      if (resetAny) {
        queueMicrotask(() => {
          void processNext();
        });
      }
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

      const nativeVideoUri = opts?.nativeVideoUri?.trim() || payload.nativeVideoUri?.trim() || undefined;

      const readyJob: UploadOutboxJob = {
        ...job,
        blobsReady: true,
        status: 'queued',
        error: null,
        nativeVideoUri: nativeVideoUri ?? job.nativeVideoUri,
        captureTimestampMissing: payload.captureTimestampMissing ?? job.captureTimestampMissing,
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
        let sourcePath = nativeVideoUri;
        // Native only: on web the Filesystem plugin would base64 the whole clip into a
        // second IndexedDB store that nothing reads or cleans up — the IDB outbox blob
        // above is the durable copy there.
        if (!sourcePath && isNativeApp()) {
          try {
            sourcePath = await writeVideoToNativeCache(videoBlob, job.fileName);
          } catch (err) {
            console.warn('ClipUploadQueue writeVideoToNativeCache:', err);
          }
        }
        const durablePath = isNativeApp()
          ? await persistDurableVideoFile({
              jobId: job.id,
              sourcePath,
              fileName: job.fileName,
            })
          : null;
        if (durablePath && durablePath !== nativeVideoUri) {
          updateJob(job.id, { nativeVideoUri: durablePath });
        }
        await clearPendingCapture();
        void persistClipInBackground({
          jobId: job.id,
          video: videoBlob,
          fileName: job.fileName,
          thumbnailFile: payload.thumbnailFile,
          nativeVideoUri: durablePath ?? nativeVideoUri,
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

        const activeOnJob = isBlockingInFlightStatus(job.status);
        if (activeOnJob) {
          abortForStallRef.current.delete(id);
          abortByJobRef.current.get(id)?.abort();
          processingIdsRef.current.delete(id);
          processingStartedAtRef.current.delete(id);
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
          const nativeOk = await nativeOutboxFileExists(job.nativeVideoUri);
          if (!blobs?.video && !nativeOk) {
            updateJob(id, {
              status: 'paused',
              blobsReady: false,
              error:
                'Waiting to restore this clip from the device. It is still in your queue — retry after the app finishes saving.',
            });
            return;
          }
          if (blobs?.video) {
            registerClipBlob(id, blobs.video);
          }
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

  const dismissJob = useCallback(
    (id: string) => {
      clearAutoRetryTimer(id);
      abortForStallRef.current.delete(id);
      abortByJobRef.current.get(id)?.abort();
      abortByJobRef.current.delete(id);
      processingIdsRef.current.delete(id);
      processingStartedAtRef.current.delete(id);
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== id);
        jobsRef.current = next;
        void persist(next);
        return next;
      });
      void deleteOutboxJob(id).catch(() => {
        /* ignore */
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
          j.status === 'paused' ||
          j.status === 'waiting',
      ).length,
    [jobs],
  );

  const value = useMemo(
    () => ({
      jobs,
      activeCount,
      enqueue,
      restartJob,
      dismissJob,
    }),
    [jobs, activeCount, enqueue, restartJob, dismissJob],
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
      dismissJob: () => {},
    };
  }
  return ctx;
}
