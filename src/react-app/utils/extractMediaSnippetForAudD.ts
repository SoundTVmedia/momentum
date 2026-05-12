const SNIPPET_MS = 14_000;
const MIN_RECORD_MS = 3_000;

/**
 * Records a short segment from a local video blob via `captureStream()` for music recognition (e.g. AudD).
 * Returns null if the browser cannot capture or record.
 *
 * Notes:
 * - `captureStream()` follows the element’s **volume**; values near 0 produced effectively silent
 *   snippets and tripped “not enough audio” — use full gain for the capture window (brief in-memory playback).
 * - Prefer **audio-only** `MediaRecorder` when the captured stream has an audio track (smaller, more reliable for AudD).
 */
export async function extractMediaSnippetForAudD(blob: Blob): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.muted = false;
  video.volume = 1;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('loadeddata', onReady);
        reject(new Error('load timeout'));
      }, 25_000);
      const onReady = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('loadeddata', onReady);
        resolve();
      };
      video.addEventListener('loadedmetadata', onReady);
      video.addEventListener('loadeddata', onReady);
      video.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('loadeddata', onReady);
        reject(new Error('video error'));
      };
    });

    const durationSec =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : SNIPPET_MS / 1000;
    const durMs = Math.floor(durationSec * 1000);
    /** At least ~3s when the clip is long enough; never longer than the clip or 14s. */
    const recordMs = Math.min(SNIPPET_MS, durMs, Math.max(MIN_RECORD_MS, durMs - 300));

    const v = video as HTMLVideoElement & {
      captureStream?: (frameRate?: number) => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const captured =
      typeof v.captureStream === 'function'
        ? v.captureStream(30)
        : v.mozCaptureStream?.() ?? null;
    if (!captured || captured.getTracks().length === 0) {
      return null;
    }

    const audioTracks = captured.getAudioTracks();
    const recordStream =
      audioTracks.length > 0 ? new MediaStream(audioTracks) : captured;

    const pickMime = (audioOnly: boolean): string | null => {
      const candidates = audioOnly
        ? [
            'audio/webm;codecs=opus',
            'audio/webm',
            'video/webm;codecs=opus',
            'video/webm',
          ]
        : [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'audio/webm;codecs=opus',
          ];
      for (const m of candidates) {
        if (MediaRecorder.isTypeSupported(m)) return m;
      }
      return null;
    };

    const audioOnly = recordStream.getVideoTracks().length === 0;
    const mimeType = pickMime(audioOnly);
    if (!mimeType) return null;

    const chunks: Blob[] = [];
    const mr = new MediaRecorder(recordStream, { mimeType });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });

    try {
      await video.play();
    } catch {
      if (mr.state !== 'inactive') {
        try {
          mr.stop();
        } catch {
          /* not started */
        }
      }
      captured.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      return null;
    }

    /** Let the decoder produce audio frames before MediaRecorder starts. */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    mr.start(250);

    await new Promise((r) => setTimeout(r, recordMs));

    if (typeof mr.requestData === 'function') {
      try {
        mr.requestData();
      } catch {
        /* optional */
      }
    }
    mr.stop();
    video.pause();
    captured.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    await stopped;

    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: mr.mimeType || mimeType });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
