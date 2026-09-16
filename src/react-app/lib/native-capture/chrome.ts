/** Refcount so AppRouteChrome + QuickRecordButton never drop transparency mid-capture. */
let nativeCaptureChromeLocks = 0;
let pendingChromeClose: ReturnType<typeof setTimeout> | null = null;
let overlayMediaLocks = 0;

function pauseOutletMedia(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLVideoElement>('.app-route-outlet video').forEach((video) => {
    if (video.closest('.native-capture-modal')) return;
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  });
}

function applyNativeCaptureChromeOpen(): void {
  if (pendingChromeClose != null) {
    clearTimeout(pendingChromeClose);
    pendingChromeClose = null;
  }
  document.documentElement.classList.add('native-quick-capture-open');
  pauseOutletMedia();
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

/** Hide feed/hero videos while the capture HUD is open (web + native). */
export function acquireCaptureOverlayMediaLock(): () => void {
  overlayMediaLocks += 1;
  if (overlayMediaLocks === 1) {
    document.documentElement.classList.add('capture-overlay-open');
    pauseOutletMedia();
  }
  return () => {
    overlayMediaLocks = Math.max(0, overlayMediaLocks - 1);
    if (overlayMediaLocks === 0) {
      document.documentElement.classList.remove('capture-overlay-open');
    }
  };
}
