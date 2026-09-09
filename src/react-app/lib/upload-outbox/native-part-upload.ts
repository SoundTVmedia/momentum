import { BackgroundUpload } from '@feedback/background-upload';
import { isNativeApp } from '@/react-app/lib/native-bridge';
import { UPLOAD_PART_SIZE_BYTES } from '@/shared/upload';
import { getNetworkReachability } from './network-utils';

type PartWaiter = {
  resolve: () => void;
  reject: (err: Error) => void;
};

const waiters = new Map<string, PartWaiter>();
let listenersStarted = false;

function waiterKey(jobId: string, partNumber: number): string {
  return `${jobId}#${partNumber}`;
}

function startPartListeners(): void {
  if (listenersStarted) return;
  listenersStarted = true;
  void BackgroundUpload.addListener('uploadPartComplete', (event) => {
    const waiter = waiters.get(waiterKey(event.jobId, event.partNumber));
    if (!waiter) return;
    waiters.delete(waiterKey(event.jobId, event.partNumber));
    waiter.resolve();
  });
  void BackgroundUpload.addListener('uploadPartFailed', (event) => {
    const waiter = waiters.get(waiterKey(event.jobId, event.partNumber));
    if (!waiter) return;
    waiters.delete(waiterKey(event.jobId, event.partNumber));
    waiter.reject(new Error(event.error || `Part ${event.partNumber} upload failed`));
  });
}

function waitForPart(jobId: string, partNumber: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const key = waiterKey(jobId, partNumber);
    const onAbort = () => {
      waiters.delete(key);
      reject(new Error('Upload cancelled'));
    };
    waiters.set(key, {
      resolve: () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      },
      reject: (err) => {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      },
    });
    if (signal) {
      if (signal.aborted) {
        waiters.delete(key);
        reject(new Error('Upload cancelled'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export async function canUseNativeBackgroundParts(filePath: string | null | undefined): Promise<boolean> {
  if (!isNativeApp()) return false;
  const trimmed = filePath?.trim();
  if (!trimmed) return false;
  try {
    const info = await BackgroundUpload.fileExists({ path: trimmed });
    return Boolean(info.exists && info.size > 0);
  } catch {
    return false;
  }
}

/**
 * PUT file slices via the platform background session (URLSession / native HTTP).
 * Completes when the OS reports the part finished — survives app backgrounding.
 */
export async function uploadNativeFileMultipart(options: {
  jobId: string;
  sessionId: string;
  filePath: string;
  fileSize: number;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { jobId, sessionId, filePath, fileSize, onProgress, signal } = options;
  startPartListeners();
  const partSize = UPLOAD_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));
  let uploaded = 0;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    if (signal?.aborted) throw new Error('Upload cancelled');
    const reachable = await getNetworkReachability();
    if (!reachable.connected) {
      throw new TypeError('Network error during part upload');
    }
    const start = (partNumber - 1) * partSize;
    const length = Math.min(partSize, fileSize - start);
    const url = `${origin}/api/uploads/${sessionId}/parts/${partNumber}`;
    const done = waitForPart(jobId, partNumber, signal);
    const scheduled = await BackgroundUpload.uploadPart({
      jobId,
      partNumber,
      url,
      filePath,
      offset: start,
      length,
      httpMethod: 'PUT',
    });
    if (!scheduled.accepted) {
      throw new Error(`Part ${partNumber} upload failed: native uploader unavailable`);
    }
    await done;
    uploaded += length;
    onProgress?.(Math.round((uploaded / Math.max(fileSize, 1)) * 100));
  }
}
