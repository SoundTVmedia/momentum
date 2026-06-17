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
  deleteOutboxJob,
  loadOutboxMeta,
  saveOutboxBlobs,
  saveOutboxMeta,
} from '@/react-app/lib/upload-outbox/idb';
import { jobFromPayload, runOutboxJob } from '@/react-app/lib/upload-outbox/runner';
import type { PersistedOutboxMeta, UploadOutboxJob } from '@/react-app/lib/upload-outbox/types';
import { scheduleNativeBackgroundUpload } from '@/react-app/lib/native-bridge';

const MAX_QUEUE_SIZE = 5;
const DONE_TTL_MS = 8000;

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
        const revived = meta.map((m) => {
          const job = reviveJob(m);
          if (job.status === 'uploading' || job.status === 'completing') {
            return { ...job, status: 'queued' as const };
          }
          return job;
        });
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

    const pending = jobsRef.current.find((j) => j.status === 'queued');
    if (!pending) return;

    processingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

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
      updateJob(pending.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
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
  }, [hydrated, jobs.length, processNext]);

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
      if (!blob && !file) return null;

      const job = jobFromPayload(payload, previewObjectUrl);
      const videoBlob = blob ?? file!;

      void saveOutboxBlobs(job.id, {
        video: videoBlob instanceof File ? videoBlob : videoBlob,
        thumbnail: payload.thumbnailFile ?? null,
      });

      setJobs((prev) => {
        const next = [...prev, job];
        jobsRef.current = next;
        void persist(next);
        return next;
      });

      queueMicrotask(() => {
        scheduleNativeBackgroundUpload(job.id);
        void processNext();
      });

      return job.id;
    },
    [persist, processNext],
  );

  const retryJob = useCallback(
    (id: string) => {
      updateJob(id, {
        status: 'queued',
        error: null,
        progress: 0,
      });
      queueMicrotask(() => {
        void processNext();
      });
    },
    [processNext, updateJob],
  );

  const dismissJob = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
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
          j.status === 'uploading' ||
          j.status === 'completing' ||
          j.status === 'processing',
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
