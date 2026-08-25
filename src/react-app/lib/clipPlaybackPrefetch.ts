import {
  resolveFeedPreviewVideoSrc,
  resolveHlsPrefetchUrls,
  resolveModalPlaybackSource,
  resolveModalPrefetchPlan,
  STREAM_DELIVERY_ORIGIN,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';

const prefetchedModalKeys = new Set<string>();
const prefetchedFeedMp4 = new Set<string>();
const prefetchedHlsManifests = new Set<string>();

/** First ~1.5MB — enough for moov + early GOPs on typical Stream MP4s. */
const MP4_HEAD_PREFETCH_BYTES = 1_500_000;

function modalPrefetchKey(clip: ClipPlaybackFields): string {
  const modal = resolveModalPlaybackSource(clip);
  return modal.streamVideoId ?? modal.src;
}

async function prefetchHlsStartup(hlsUrl: string): Promise<void> {
  const url = hlsUrl.trim();
  if (!url || prefetchedHlsManifests.has(url)) return;
  prefetchedHlsManifests.add(url);

  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HLS manifest ${res.status}`);
    const text = await res.text();
    const nextUrls = resolveHlsPrefetchUrls(text, url);

    if (nextUrls.length === 1 && nextUrls[0].includes('.m3u8')) {
      const variantUrl = nextUrls[0];
      if (!prefetchedHlsManifests.has(variantUrl)) {
        prefetchedHlsManifests.add(variantUrl);
        const variantRes = await fetch(variantUrl, { mode: 'cors', credentials: 'omit' });
        if (variantRes.ok) {
          const variantText = await variantRes.text();
          const segments = resolveHlsPrefetchUrls(variantText, variantUrl);
          await Promise.all(
            segments.map((seg) =>
              fetch(seg, { mode: 'cors', credentials: 'omit' }).catch(() => undefined),
            ),
          );
        }
      }
      return;
    }

    await Promise.all(
      nextUrls.map((seg) =>
        fetch(seg, { mode: 'cors', credentials: 'omit' }).catch(() => undefined),
      ),
    );
  } catch {
    prefetchedHlsManifests.delete(url);
  }
}

/** Warm CDN bytes for progressive MP4 without spinning up a decoder. */
function prefetchMp4Head(src: string): void {
  const url = src.trim();
  if (!url || prefetchedFeedMp4.has(url)) return;
  prefetchedFeedMp4.add(url);

  void fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    headers: { Range: `bytes=0-${MP4_HEAD_PREFETCH_BYTES - 1}` },
  }).catch(() => {
    // Some CDNs reject Range — fall back to a short-lived muted video warm.
    const el = document.createElement('video');
    el.preload = 'auto';
    el.muted = true;
    el.playsInline = true;
    el.src = url;
    el.load();
    window.setTimeout(() => {
      el.removeAttribute('src');
      el.load();
      el.remove();
    }, 20_000);
  });
}

/** Warm CDN MP4 for feed hover / scroll (best-effort; avoids HLS in grid). */
export function prefetchFeedPreviewMp4(src: string | null | undefined): void {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return;
  prefetchMp4Head(url);
}

/** Warm feed MP4 + modal sources for carousel neighbors on hover (best-effort). */
export function prefetchCarouselNeighborClips(
  neighbors: { next?: ClipPlaybackFields | null; prev?: ClipPlaybackFields | null },
): void {
  for (const clip of [neighbors.prev, neighbors.next]) {
    if (!clip) continue;
    prefetchFeedPreviewMp4(resolveFeedPreviewVideoSrc(clip));
    prefetchModalPlayback(clip);
  }
}

/**
 * Warm network cache for modal playback.
 * MP4-first: only prefetch the progressive source that will play. Do not warm
 * HLS while an MP4 will start — that steals first-frame bytes and radio.
 */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  const key = modalPrefetchKey(clip);
  if (!key || prefetchedModalKeys.has(key)) return;
  prefetchedModalKeys.add(key);

  const plan = resolveModalPrefetchPlan(clip);
  if (plan.progressiveUrl) {
    prefetchMp4Head(plan.progressiveUrl);
    return;
  }
  if (plan.hlsUrl) {
    void prefetchHlsStartup(plan.hlsUrl);
  }
}

/** Inject preconnect to Stream CDN (idempotent). */
export function preconnectStreamDelivery(): void {
  const href = STREAM_DELIVERY_ORIGIN;
  if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  const dns = document.createElement('link');
  dns.rel = 'dns-prefetch';
  dns.href = href;
  document.head.appendChild(dns);
}
