import { BackgroundUpload, type ReachabilityStatus } from '@feedback/background-upload';
import { isNativeApp } from '@/react-app/lib/native-bridge';

export type { ReachabilityStatus };

/** Last OS/browser reachability snapshot. Never polled — updated by events. */
let cached: ReachabilityStatus = {
  connected: typeof navigator === 'undefined' ? true : navigator.onLine,
  expensive: false,
};

let started = false;
const listeners = new Set<(status: ReachabilityStatus) => void>();

function emit(status: ReachabilityStatus): void {
  cached = status;
  for (const listener of listeners) {
    try {
      listener(status);
    } catch (err) {
      console.warn('reachability listener:', err);
    }
  }
}

async function startReachability(): Promise<void> {
  if (started) return;
  started = true;
  try {
    cached = await BackgroundUpload.getReachability();
  } catch {
    cached = {
      connected: typeof navigator === 'undefined' ? true : navigator.onLine,
      expensive: false,
    };
  }
  await BackgroundUpload.addListener('reachabilityChange', (status) => {
    emit(status);
  });
  if (!isNativeApp() && typeof window !== 'undefined') {
    const onBrowser = () => emit({ connected: navigator.onLine, expensive: false });
    window.addEventListener('online', onBrowser);
    window.addEventListener('offline', onBrowser);
  }
}

/** Call once from the upload queue provider. Idempotent. */
export function initUploadReachability(): () => void {
  void startReachability();
  return () => {
    /* listeners stay for the app lifetime; provider unmount is rare */
  };
}

/** Synchronous snapshot for UI labels. Prefer wait/subscribe before attempts. */
export function isNetworkAvailable(): boolean {
  return cached.connected;
}

export async function getNetworkReachability(): Promise<ReachabilityStatus> {
  await startReachability();
  try {
    cached = await BackgroundUpload.getReachability();
  } catch {
    /* keep last snapshot */
  }
  return cached;
}

export function subscribeReachability(listener: (status: ReachabilityStatus) => void): () => void {
  void startReachability();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resolves when the OS reports a usable path. Does not poll. */
export function waitForUsableNetwork(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cached.connected) {
      resolve();
      return;
    }
    const onAbort = () => {
      cleanup();
      reject(new Error('Upload cancelled'));
    };
    const unsub = subscribeReachability((status) => {
      if (!status.connected) return;
      cleanup();
      resolve();
    });
    const cleanup = () => {
      unsub();
      signal?.removeEventListener('abort', onAbort);
    };
    if (signal) {
      if (signal.aborted) {
        cleanup();
        reject(new Error('Upload cancelled'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    void getNetworkReachability().then((status) => {
      if (status.connected) {
        cleanup();
        resolve();
      }
    });
  });
}
