import {
  resolveFeedPreviewVideoSrc,
  resolveHlsPrefetchUrls,
  resolveModalPlaybackSource,
  STREAM_DELIVERY_ORIGIN,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';

const prefetchedModalKeys = new Set<string>();
const prefetchedFeedMp4 = new Set<string>();
const prefetchedHlsManifests = new Set<string>();

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

/** Warm CDN MP4 for feed hover / scroll (best-effort; avoids HLS in grid). */
export function prefetchFeedPreviewMp4(src: string | null | undefined): void {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url || prefetchedFeedMp4.has(url)) return;
  prefetchedFeedMp4.add(url);

  // `<link rel=preload as=video>` is not supported in Chromium — use a muted video element instead.
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
  }, 45_000);
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

/** Warm network cache for modal playback: Stream MP4 + HLS manifest/segments (best-effort). */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  const key = modalPrefetchKey(clip);
  if (!key || prefetchedModalKeys.has(key)) return;
  prefetchedModalKeys.add(key);

  const modal = resolveModalPlaybackSource(clip);

  if (!modal.isHls && modal.src) {
    prefetchFeedPreviewMp4(modal.src);
  } else if (modal.src) {
    void prefetchHlsStartup(modal.src);
  }

  if (modal.hlsFallbackSrc) {
    void prefetchHlsStartup(modal.hlsFallbackSrc);
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
