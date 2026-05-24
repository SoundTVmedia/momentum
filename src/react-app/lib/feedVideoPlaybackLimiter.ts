const NARROW_MQ = '(max-width: 767px)';

let activePreviewKey: string | null = null;

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(NARROW_MQ).matches;
}

/** On phone-sized viewports, only one feed preview may decode at a time. */
export function requestFeedPreviewPlay(key: string): boolean {
  if (!isNarrowViewport()) return true;
  if (activePreviewKey != null && activePreviewKey !== key) return false;
  activePreviewKey = key;
  return true;
}

export function releaseFeedPreviewPlay(key: string): void {
  if (activePreviewKey === key) activePreviewKey = null;
}

export function clearFeedPreviewPlayback(): void {
  activePreviewKey = null;
}
