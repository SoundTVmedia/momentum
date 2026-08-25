/** Subset of the Network Information API used to decide full-clip prefetch. */
export type NetworkConnectionLike = {
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
  downlink?: number;
};

/**
 * Whether to pull the entire ≤60s MP4 (not just the first GOPs).
 * 5G is usually reported as `effectiveType: '4g'` on Android; iOS often has
 * no Network Information API at all.
 */
export function shouldPrefetchFullClip(input: {
  connection?: NetworkConnectionLike | null;
  nativeApp?: boolean;
  sessionLooksFast?: boolean;
}): boolean {
  const c = input.connection ?? null;
  if (c?.saveData) return false;

  const effective = (c?.effectiveType ?? '').toLowerCase();
  if (effective === 'slow-2g' || effective === '2g' || effective === '3g') {
    return false;
  }

  const downlink = Number(c?.downlink);
  if (Number.isFinite(downlink) && downlink > 0 && downlink < 3) return false;
  if (Number.isFinite(downlink) && downlink >= 8) return true;

  const type = (c?.type ?? '').toLowerCase();
  if (type === 'wifi' || type === 'ethernet') return true;
  // Android 5G / LTE-A typically show up as 4g.
  if (effective === '4g') return true;

  if (input.sessionLooksFast) return true;
  // Capacitor/iOS: no connection API. Full next-clip is the 5G case we care about;
  // saveData/slow already returned above when the API exists.
  if (input.nativeApp && !c) return true;

  return false;
}

export function readNavigatorConnection(): NetworkConnectionLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkConnectionLike;
    mozConnection?: NetworkConnectionLike;
    webkitConnection?: NetworkConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}
