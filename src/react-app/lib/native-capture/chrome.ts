/** Refcount so AppRouteChrome + QuickRecordButton never drop transparency mid-capture. */
let nativeCaptureChromeLocks = 0;
let pendingChromeClose: ReturnType<typeof setTimeout> | null = null;

function applyNativeCaptureChromeOpen(): void {
  if (pendingChromeClose != null) {
    clearTimeout(pendingChromeClose);
    pendingChromeClose = null;
  }
  document.documentElement.classList.add('native-quick-capture-open');
}

function scheduleNativeCaptureChromeClose(): void {
  if (pendingChromeClose != null) {
    clearTimeout(pendingChromeClose);
  }
  // Brief deferral survives React StrictMode unmount/remount and lock handoffs.
  pendingChromeClose = setTimeout(() => {
    pendingChromeClose = null;
    if (nativeCaptureChromeLocks === 0) {
      document.documentElement.classList.remove('native-quick-capture-open');
    }
  }, 64);
}

export function acquireNativeCaptureChromeLock(): () => void {
  nativeCaptureChromeLocks += 1;
  if (nativeCaptureChromeLocks === 1) {
    applyNativeCaptureChromeOpen();
  }
  return () => {
    nativeCaptureChromeLocks = Math.max(0, nativeCaptureChromeLocks - 1);
    if (nativeCaptureChromeLocks === 0) {
      scheduleNativeCaptureChromeClose();
    }
  };
}
