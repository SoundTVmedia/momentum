import {
  isHlsPlaybackUrl,
  resolveFeedPreviewVideoSrc,
  resolveHlsPrefetchUrls,
  resolveModalPrefetchPlan,
  STREAM_DELIVERY_ORIGIN,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';
import { isNativeApp } from '@/react-app/lib/native-bridge';

/** Next + next-next. The visible player owns the current clip. */
const MAX_WARM_VIDEOS = 2;
const MAX_HLS_PREFETCH = 6;

type WarmEntry = {
  el: HTMLVideoElement;
  url: string;
  abort: AbortController | null;
};

const warmByUrl = new Map<string, WarmEntry>();
const hlsPrefetchAbort = new Map<string, AbortController>();
const prefetchedHlsManifests = new Set<string>();

/** Desktop MSE, or iOS 17.1+ ManagedMediaSource — hls.js can ABR without swapping `video.src`. */
export function hlsJsLikelySupported(): boolean {
  if (typeof window === 'undefined') return false;
  if ('ManagedMediaSource' in window) return true;
  const mediaSource = window.MediaSource;
  return (
    typeof mediaSource !== 'undefined' &&
    typeof mediaSource.isTypeSupported === 'function' &&
    mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')
  );
}

export function canUseNativeHls(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'));
}

function urlsForClip(clip: ClipPlaybackFields): string[] {
  const plan = resolveModalPrefetchPlan(clip);
  const urls: string[] = [];
  if (plan.hlsUrl) {
    urls.push(plan.hlsUrl);
  }
  if (plan.progressiveUrl) urls.push(plan.progressiveUrl);
  const preview = resolveFeedPreviewVideoSrc(clip);
  if (preview) urls.push(preview);
  return urls;
}

/** After a clip actually started quickly — kept for callers; no longer triggers full-file fetch. */
export function markPlaybackSessionFast(): void {
  /* ABR start-low + short HLS prefetch replaced full-MP4 warming. */
}

/** Network URL (blob cache removed — full-file prefetch froze the native app). */
export function resolvePrefetchedPlaybackSrc(src: string | null | undefined): string {
  const url = typeof src === 'string' ? src.trim() : '';
  return url;
}

/**
 * Drop the hidden decoder once the visible player owns this URL.
 */
export function releaseWarmedDecoder(src: string | null | undefined): void {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return;
  const entry = warmByUrl.get(url);
  if (!entry) return;
  teardownVideo(entry);
  warmByUrl.delete(url);
}

function teardownVideo(entry: WarmEntry): void {
  entry.abort?.abort();
  entry.abort = null;
  try {
    entry.el.pause();
    entry.el.removeAttribute('src');
    entry.el.load();
    entry.el.remove();
  } catch {
    /* already detached */
  }
}

function evictOldestIfNeeded(): void {
  while (warmByUrl.size >= MAX_WARM_VIDEOS) {
    const oldest = warmByUrl.keys().next().value as string | undefined;
    if (!oldest) break;
    const entry = warmByUrl.get(oldest);
    if (entry) teardownVideo(entry);
    warmByUrl.delete(oldest);
  }
}

function touch(url: string): void {
  const entry = warmByUrl.get(url);
  if (!entry) return;
  warmByUrl.delete(url);
  warmByUrl.set(url, entry);
}

function prefetchHost(): HTMLDivElement {
  let el = document.getElementById('clip-playback-prefetch-host') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'clip-playback-prefetch-host';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(el);
  }
  return el;
}

/** iOS ignores preload="auto" unless playback actually starts (muted is enough). */
function kickBuffer(el: HTMLVideoElement): void {
  void el
    .play()
    .then(() => {
      el.pause();
    })
    .catch(() => undefined);
}

function warmMediaElement(url: string): void {
  if (typeof document === 'undefined') return;
  let entry = warmByUrl.get(url);
  if (!entry) {
    evictOldestIfNeeded();
    const el = document.createElement('video');
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    if ('disableRemotePlayback' in el) {
      el.disableRemotePlayback = true;
    }
    el.src = url;
    prefetchHost().appendChild(el);
    el.load();
    entry = { el, url, abort: null };
    warmByUrl.set(url, entry);
  } else {
    touch(url);
  }
  kickBuffer(entry.el);
}

function trimHlsPrefetchSet(): void {
  while (prefetchedHlsManifests.size > MAX_HLS_PREFETCH) {
    const oldest = prefetchedHlsManifests.keys().next().value as string | undefined;
    if (!oldest) break;
    prefetchedHlsManifests.delete(oldest);
  }
}

async function prefetchHlsStartup(hlsUrl: string, signal: AbortSignal): Promise<void> {
  const url = hlsUrl.trim();
  if (!url || prefetchedHlsManifests.has(url)) return;
  prefetchedHlsManifests.add(url);
  trimHlsPrefetchSet();

  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
    if (!res.ok) throw new Error(`HLS manifest ${res.status}`);
    const text = await res.text();
    const nextUrls = resolveHlsPrefetchUrls(text, url);

    if (nextUrls.length === 1 && nextUrls[0].includes('.m3u8')) {
      const variantUrl = nextUrls[0];
      if (!prefetchedHlsManifests.has(variantUrl)) {
        prefetchedHlsManifests.add(variantUrl);
        trimHlsPrefetchSet();
        const variantRes = await fetch(variantUrl, { mode: 'cors', credentials: 'omit', signal });
        if (variantRes.ok) {
          const variantText = await variantRes.text();
          const segments = resolveHlsPrefetchUrls(variantText, variantUrl);
          await Promise.all(
            segments.map((seg) =>
              fetch(seg, { mode: 'cors', credentials: 'omit', signal }).catch(() => undefined),
            ),
          );
        }
      }
      return;
    }

    await Promise.all(
      nextUrls.map((seg) =>
        fetch(seg, { mode: 'cors', credentials: 'omit', signal }).catch(() => undefined),
      ),
    );
  } catch {
    prefetchedHlsManifests.delete(url);
  }
}

function startHlsPrefetch(hlsUrl: string): void {
  const url = hlsUrl.trim();
  if (!url || hlsPrefetchAbort.has(url) || prefetchedHlsManifests.has(url)) return;
  const abort = new AbortController();
  hlsPrefetchAbort.set(url, abort);
  void prefetchHlsStartup(url, abort.signal).finally(() => {
    if (hlsPrefetchAbort.get(url) === abort) hlsPrefetchAbort.delete(url);
  });
}

/** Warm feed preview URL through a real decoder — first GOPs only, never the whole file. */
export function prefetchFeedPreviewMp4(src: string | null | undefined): void {
  if (isNativeApp()) return;
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return;
  if (isHlsPlaybackUrl(url)) {
    if (hlsJsLikelySupported() || !canUseNativeHls()) startHlsPrefetch(url);
    else warmMediaElement(url);
    return;
  }
  warmMediaElement(url);
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
 * Warm the source the modal will actually play (HLS first segments, or a
 * progressive head via a hidden `<video>`). Does not download whole MP4s.
 */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  if (typeof document === 'undefined') return;
  const plan = resolveModalPrefetchPlan(clip);
  if (plan.hlsUrl) {
    if (hlsJsLikelySupported() || !canUseNativeHls()) {
      startHlsPrefetch(plan.hlsUrl);
      return;
    }
    warmMediaElement(plan.hlsUrl);
    return;
  }
  if (plan.progressiveUrl) {
    warmMediaElement(plan.progressiveUrl);
  }
}

/**
 * Drop neighbor warmup that is no longer next / next-next (fast scroll).
 * Hidden decoders and in-flight HLS segment fetches are aborted.
 */
export function cancelModalPrefetchExcept(keepClips: Array<ClipPlaybackFields | null | undefined>): void {
  const keep = new Set<string>();
  for (const clip of keepClips) {
    if (!clip) continue;
    for (const url of urlsForClip(clip)) keep.add(url);
  }

  for (const [url, entry] of [...warmByUrl.entries()]) {
    if (keep.has(url)) continue;
    teardownVideo(entry);
    warmByUrl.delete(url);
  }

  for (const [url, abort] of [...hlsPrefetchAbort.entries()]) {
    if (keep.has(url)) continue;
    abort.abort();
    hlsPrefetchAbort.delete(url);
    prefetchedHlsManifests.delete(url);
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
