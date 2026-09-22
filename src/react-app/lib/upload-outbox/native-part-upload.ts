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

export type NativePartPlan = {
  totalParts: number;
  /** Bytes already on the server, so progress starts where the last run stopped. */
  alreadyUploadedBytes: number;
  parts: Array<{ partNumber: number; offset: number; length: number }>;
};

/**
 * Byte ranges still missing on the server. A background URLSession keeps
 * uploading after the WebView is killed; when the app relaunches the runner
 * restarts the job, so anything the server already has must be skipped instead
 * of re-sent (the browser path does the same via `completedPartNumbers`).
 */
export function planNativeParts(
  fileSize: number,
  completedPartNumbers: Iterable<number> = [],
  partSize = UPLOAD_PART_SIZE_BYTES,
): NativePartPlan {
  const size = Math.max(0, fileSize);
  const totalParts = Math.max(1, Math.ceil(size / partSize));
  const completed = new Set<number>();
  for (const n of completedPartNumbers) {
    if (Number.isInteger(n) && n >= 1 && n <= totalParts) completed.add(n);
  }
  const parts: NativePartPlan['parts'] = [];
  let alreadyUploadedBytes = 0;
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const offset = (partNumber - 1) * partSize;
    const length = Math.max(0, Math.min(partSize, size - offset));
    if (completed.has(partNumber)) {
      alreadyUploadedBytes += length;
      continue;
    }
    parts.push({ partNumber, offset, length });
  }
  return { totalParts, alreadyUploadedBytes, parts };
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
  /** Parts the server already reports as received (from `/status`). */
  completedPartNumbers?: number[];
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { jobId, sessionId, filePath, fileSize, completedPartNumbers, onProgress, signal } =
    options;
  startPartListeners();
  const plan = planNativeParts(fileSize, completedPartNumbers ?? []);
  let uploaded = plan.alreadyUploadedBytes;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (uploaded > 0) {
    onProgress?.(Math.round((uploaded / Math.max(fileSize, 1)) * 100));
  }

  for (const { partNumber, offset, length } of plan.parts) {
    if (signal?.aborted) throw new Error('Upload cancelled');
    if (length <= 0) continue;
    const reachable = await getNetworkReachability();
    if (!reachable.connected) {
      throw new TypeError('Network error during part upload');
    }
    const url = `${origin}/api/uploads/${sessionId}/parts/${partNumber}`;
    const done = waitForPart(jobId, partNumber, signal);
    const scheduled = await BackgroundUpload.uploadPart({
      jobId,
      partNumber,
      url,
      filePath,
      offset,
      length,
      httpMethod: 'PUT',
    });
    if (!scheduled.accepted) {
      waiters.delete(waiterKey(jobId, partNumber));
      throw new Error(`Part ${partNumber} upload failed: native uploader unavailable`);
    }
    await done;
    uploaded += length;
    onProgress?.(Math.round((uploaded / Math.max(fileSize, 1)) * 100));
  }
}
