/** Best-effort online check (airplane mode sets navigator.onLine false). */
export function isNetworkAvailable(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
