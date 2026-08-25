import {
  isHlsPlaybackUrl,
  resolveModalPrefetchPlan,
  type ClipPlaybackFields,
} from '@shared/clip-playback';

/** First ~1.5MB — enough for moov + early GOPs on typical Stream MP4s. */
const MP4_HEAD_PREFETCH_BYTES = 1_500_000;

const warmed = new Set<string>();

/**
 * Warm HTTP cache for the bytes the native player will request first.
 * Skips HLS when the confirmed Stream MP4 is the start path.
 */
export function prefetchClipPlayback(clip: ClipPlaybackFields): void {
  const plan = resolveModalPrefetchPlan(clip);
  if (plan.progressiveUrl) {
    prefetchProgressiveHead(plan.progressiveUrl);
    return;
  }
  if (plan.hlsUrl) prefetchProgressiveHead(plan.hlsUrl);
}

export function prefetchNeighborClips(
  clips: ClipPlaybackFields[],
  activeIndex: number,
): void {
  for (const offset of [0, 1, 2]) {
    const clip = clips[activeIndex + offset];
    if (clip) prefetchClipPlayback(clip);
  }
}

function prefetchProgressiveHead(url: string): void {
  const src = url.trim();
  if (!src || warmed.has(src)) return;
  warmed.add(src);

  const headers: Record<string, string> = {};
  if (!isHlsPlaybackUrl(src)) {
    headers.Range = `bytes=0-${MP4_HEAD_PREFETCH_BYTES - 1}`;
  }

  void fetch(src, { method: 'GET', headers }).catch(() => {
    warmed.delete(src);
  });
}
