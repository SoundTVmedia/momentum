const SNIPPET_MS = 14_000;

/**
 * Records ~14s from a local video blob via `captureStream()` for music recognition (e.g. AudD).
 * Returns null if the browser cannot capture or record.
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
  video.volume = 0.001;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('load timeout')), 18_000);
      const done = () => {
        window.clearTimeout(timeout);
      };
      video.onloadeddata = () => {
        done();
        resolve();
      };
      video.onerror = () => {
        done();
        reject(new Error('video error'));
      };
    });

    const stream =
      typeof video.captureStream === 'function'
        ? video.captureStream()
        : (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
    if (!stream || stream.getTracks().length === 0) {
      return null;
    }

    const pickMime = (): string | null => {
      const candidates = [
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
    const mimeType = pickMime();
    if (!mimeType) return null;

    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });

    mr.start(250);
    try {
      await video.play();
    } catch {
      mr.stop();
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    await new Promise((r) => setTimeout(r, SNIPPET_MS));
    mr.stop();
    video.pause();
    stream.getTracks().forEach((t) => t.stop());
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
