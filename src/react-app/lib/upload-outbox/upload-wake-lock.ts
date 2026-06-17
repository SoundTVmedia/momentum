let wakeLock: WakeLockSentinel | null = null;
let holdCount = 0;

export async function acquireUploadWakeLock(): Promise<void> {
  holdCount += 1;
  if (holdCount > 1 || wakeLock) return;
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    /* denied or unsupported */
  }
}

export async function releaseUploadWakeLock(): Promise<void> {
  holdCount = Math.max(0, holdCount - 1);
  if (holdCount > 0) return;
  try {
    await wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

/** Re-acquire after tab becomes visible (mobile browsers release wake locks). */
export function bindUploadWakeLockVisibility(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && holdCount > 0 && !wakeLock) {
      void acquireUploadWakeLock();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
