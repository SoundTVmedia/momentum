import {
  isHlsPlaybackUrl,
  resolveFeedPreviewVideoSrc,
  resolveHlsPrefetchUrls,
  resolveModalPrefetchPlan,
  STREAM_DELIVERY_ORIGIN,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';
import {
  readNavigatorConnection,
  shouldPrefetchFullClip,
} from '@/shared/playback-network';
import { isNativeApp } from '@/react-app/lib/native-bridge';

/** Next + next-next. The visible player owns the current clip. */
const MAX_WARM_VIDEOS = 2;
const MAX_INFLIGHT_FULL = 1;

type WarmEntry = {
  el: HTMLVideoElement;
  url: string;
  abort: AbortController | null;
  full: boolean;
};

const warmByUrl = new Map<string, WarmEntry>();
const blobByUrl = new Map<string, string>();
const fullQueue: string[] = [];
let inflightFull = 0;
let sessionLooksFast = false;

const prefetchedHlsManifests = new Set<string>();

function decideFull(): boolean {
  return shouldPrefetchFullClip({
    connection: readNavigatorConnection(),
    nativeApp: isNativeApp(),
    sessionLooksFast,
  });
}

function canUseNativeHls(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'));
}

/** After a clip actually started quickly, treat later neighbors as fast-network. */
export function markPlaybackSessionFast(): void {
  sessionLooksFast = true;
}

/** Blob URL if we already pulled the whole MP4; otherwise the network URL. */
export function resolvePrefetchedPlaybackSrc(src: string | null | undefined): string {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return '';
  return blobByUrl.get(url) ?? url;
}

/**
 * Drop the hidden decoder once the visible player owns this URL.
 * Keeps any blob: object URL so the visible element can still use it.
 */
export function releaseWarmedDecoder(src: string | null | undefined): void {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return;
  const entry = warmByUrl.get(url);
  if (!entry) return;
  teardownVideo(entry, { revokeBlob: false });
  warmByUrl.delete(url);
}

function teardownVideo(entry: WarmEntry, opts: { revokeBlob: boolean }): void {
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
  if (opts.revokeBlob) {
    const blobUrl = blobByUrl.get(entry.url);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobByUrl.delete(entry.url);
    }
  }
}

function evictOldestIfNeeded(): void {
  while (warmByUrl.size >= MAX_WARM_VIDEOS) {
    const oldest = warmByUrl.keys().next().value as string | undefined;
    if (!oldest) break;
    const entry = warmByUrl.get(oldest);
    if (entry) teardownVideo(entry, { revokeBlob: true });
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

function warmMediaElement(url: string, full: boolean): void {
  if (typeof document === 'undefined') return;
  const blobSrc = blobByUrl.get(url);
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
    el.src = blobSrc ?? url;
    prefetchHost().appendChild(el);
    el.load();
    entry = { el, url, abort: null, full: false };
    warmByUrl.set(url, entry);
  } else {
    touch(url);
  }
  kickBuffer(entry.el);
  if (full && !blobSrc && !isHlsPlaybackUrl(url)) {
    enqueueFullBlob(url);
  }
  entry.full = entry.full || full;
}

function enqueueFullBlob(url: string): void {
  if (blobByUrl.has(url) || fullQueue.includes(url)) return;
  fullQueue.push(url);
  pumpFullQueue();
}

function pumpFullQueue(): void {
  while (inflightFull < MAX_INFLIGHT_FULL && fullQueue.length > 0) {
    const url = fullQueue.shift();
    if (!url || blobByUrl.has(url)) continue;
    inflightFull += 1;
    void fetchFullBlob(url).finally(() => {
      inflightFull -= 1;
      pumpFullQueue();
    });
  }
}

async function fetchFullBlob(url: string): Promise<void> {
  const entry = warmByUrl.get(url);
  const abort = new AbortController();
  if (entry) entry.abort = abort;
  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: abort.signal,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    if (blob.size < 80_000) return;
    if (blobByUrl.has(url)) return;
    const obj = URL.createObjectURL(blob);
    blobByUrl.set(url, obj);
    const live = warmByUrl.get(url);
    if (live) {
      live.el.src = obj;
      live.el.load();
      kickBuffer(live.el);
    }
  } catch {
    /* aborted, CORS, or offline */
  }
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

/** Warm feed MP4 through a real decoder (same pipeline as playback). */
export function prefetchFeedPreviewMp4(src: string | null | undefined): void {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return;
  warmMediaElement(url, decideFull());
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
 * Warm the source the modal will actually play, in AVPlayer / `<video>` — not
 * a Range `fetch()` that WKWebView typically ignores.
 * On 5G / Wi-Fi, also pull the whole ≤60s MP4 into a blob URL.
 */
export function prefetchModalPlayback(clip: ClipPlaybackFields): void {
  if (typeof document === 'undefined') return;
  const plan = resolveModalPrefetchPlan(clip);
  const full = decideFull();
  if (plan.progressiveUrl) {
    warmMediaElement(plan.progressiveUrl, full);
    return;
  }
  if (plan.hlsUrl) {
    if (canUseNativeHls()) {
      warmMediaElement(plan.hlsUrl, false);
      return;
    }
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
