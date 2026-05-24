import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  processClipUpload,
  type ClipUploadJobPayload,
  type ClipUploadProgress,
} from '@/react-app/lib/processClipUpload';

const MAX_QUEUE_SIZE = 5;
const DONE_TTL_MS = 8000;

export type ClipUploadQueueJob = ClipUploadJobPayload & {
  id: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error: string | null;
  progress: ClipUploadProgress;
  createdAt: number;
};

type ClipUploadQueueValue = {
  jobs: ClipUploadQueueJob[];
  activeCount: number;
  enqueue: (payload: ClipUploadJobPayload) => string | null;
  retryJob: (id: string) => void;
  dismissJob: (id: string) => void;
};

const ClipUploadQueueContext = createContext<ClipUploadQueueValue | null>(null);

function newJobId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ClipUploadQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ClipUploadQueueJob[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const processingRef = useRef(false);

  const updateJob = useCallback((id: string, patch: Partial<ClipUploadQueueJob>) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, ...patch } : j));
      jobsRef.current = next;
      return next;
    });
  }, []);

  const removeJobLater = useCallback((id: string) => {
    window.setTimeout(() => {
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== id);
        jobsRef.current = next;
        return next;
      });
    }, DONE_TTL_MS);
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;

    const pending = jobsRef.current.find((j) => j.status === 'pending');
    if (!pending) return;

    processingRef.current = true;
    updateJob(pending.id, {
      status: 'uploading',
      error: null,
      progress: { video: 0, thumbnail: 0 },
    });

    try {
      await processClipUpload(pending, (progress) => {
        updateJob(pending.id, { progress });
      });
      updateJob(pending.id, { status: 'done', progress: { video: 100, thumbnail: 100 } });
      removeJobLater(pending.id);
    } catch (err) {
      updateJob(pending.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      processingRef.current = false;
      queueMicrotask(() => {
        void processNext();
      });
    }
  }, [removeJobLater, updateJob]);

  const enqueue = useCallback(
    (payload: ClipUploadJobPayload): string | null => {
      const active = jobsRef.current.filter(
        (j) => j.status === 'pending' || j.status === 'uploading',
      );
      if (active.length >= MAX_QUEUE_SIZE) {
        return null;
      }

      const id = newJobId();
      const job: ClipUploadQueueJob = {
        ...payload,
        id,
        status: 'pending',
        error: null,
        progress: { video: 0, thumbnail: 0 },
        createdAt: Date.now(),
      };

      setJobs((prev) => {
        const next = [...prev, job];
        jobsRef.current = next;
        return next;
      });

      queueMicrotask(() => {
        void processNext();
      });

      return id;
    },
    [processNext],
  );

  const retryJob = useCallback(
    (id: string) => {
      updateJob(id, {
        status: 'pending',
        error: null,
        progress: { video: 0, thumbnail: 0 },
      });
      queueMicrotask(() => {
        void processNext();
      });
    },
    [processNext, updateJob],
  );

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      jobsRef.current = next;
      return next;
    });
  }, []);

  const activeCount = useMemo(
    () => jobs.filter((j) => j.status === 'pending' || j.status === 'uploading').length,
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
