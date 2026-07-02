/** Refcount so AppRouteChrome + QuickRecordButton never drop transparency mid-capture. */
let nativeCaptureChromeLocks = 0;

export function acquireNativeCaptureChromeLock(): () => void {
  nativeCaptureChromeLocks += 1;
  if (nativeCaptureChromeLocks === 1) {
    document.documentElement.classList.add('native-quick-capture-open');
  }
  return () => {
    nativeCaptureChromeLocks = Math.max(0, nativeCaptureChromeLocks - 1);
    if (nativeCaptureChromeLocks === 0) {
      document.documentElement.classList.remove('native-quick-capture-open');
    }
  };
}
