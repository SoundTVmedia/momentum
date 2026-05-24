const STORAGE_KEY = 'momentum:perf-debug';

export function isPerfDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Enable overlay: localStorage.setItem('momentum:perf-debug', '1') then reload. */
export function countActiveVideos(): { playing: number; mounted: number } {
  if (typeof document === 'undefined') return { playing: 0, mounted: 0 };
  const videos = Array.from(document.querySelectorAll('video'));
  let playing = 0;
  for (const v of videos) {
    if (!v.paused && !v.ended) playing += 1;
  }
  return { playing, mounted: videos.length };
}
