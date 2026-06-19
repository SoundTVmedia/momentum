import {
  resolveClipDownloadFilename,
  resolveClipDownloadUrl,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';

function absoluteDownloadUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).href;
}

function triggerBrowserDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadClipVideo(
  clip: ClipPlaybackFields & {
    artist_name?: string | null;
    venue_name?: string | null;
    id?: number | string | null;
  },
  clipId?: number | string | null,
): Promise<boolean> {
  const url = resolveClipDownloadUrl(clip);
  if (!url) return false;

  const filename = resolveClipDownloadFilename(clip, clipId);
  const absoluteUrl = absoluteDownloadUrl(url);

  try {
    const res = await fetch(absoluteUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerBrowserDownload(objectUrl, filename);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
    return true;
  } catch {
    triggerBrowserDownload(absoluteUrl, filename);
    return true;
  }
}
