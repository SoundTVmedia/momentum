const SNIPPET_MS = 14_000;
/** Prefer 8s+ when the clip is long enough; shorter clips use most of their duration. */
const PREFERRED_RECORD_MS = 8_000;
const MIN_RECORD_MS = 3_000;

export type ExtractSnippetFailure =
  | 'unsupported'
  | 'load_timeout'
  | 'load_error'
  | 'no_capture_stream'
  | 'no_audio_track'
  | 'no_mime'
  | 'play_blocked'
  | 'empty_recording';

/**
 * Records a short segment from a local video blob via `captureStream()` for music recognition.
 * Returns null if the browser cannot capture or record.
 */
export type ExtractSnippetOptions = {
  /** Second pass: sample from the start of the clip (crowd intros). */
  preferStart?: boolean;
};

export async function extractMediaSnippetForAudD(
  blob: Blob,
  options?: ExtractSnippetOptions,
): Promise<Blob | null> {
  const r = await extractMediaSnippetForAudDWithReason(blob, options);
  return r.blob;
}

export async function extractMediaSnippetForAudDWithReason(
  blob: Blob,
  options?: ExtractSnippetOptions,
): Promise<{ blob: Blob | null; failure?: ExtractSnippetFailure }> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { blob: null, failure: 'unsupported' };
  }

  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.playsInline = true;
  /** Muted so `play()` works without a user gesture (iOS Safari); captureStream still gets audio. */
  video.muted = true;
  video.volume = 1;
  video.setAttribute('playsinline', '');
  video.src = url;

  try {
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          video.removeEventListener('loadedmetadata', onReady);
          video.removeEventListener('loadeddata', onReady);
          reject(new Error('load timeout'));
        }, 12_000);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      return { blob: null, failure: msg.includes('timeout') ? 'load_timeout' : 'load_error' };
    }

    const durationSec =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : SNIPPET_MS / 1000;
    const durMs = Math.floor(durationSec * 1000);
    const recordMs = Math.min(
      SNIPPET_MS,
      durMs,
      Math.max(MIN_RECORD_MS, Math.min(PREFERRED_RECORD_MS, durMs - 300)),
    );
    const startSec = options?.preferStart
      ? 0
      : durMs > recordMs + 500
        ? Math.max(0, durationSec / 2 - recordMs / 2000)
        : 0;

    const v = video as HTMLVideoElement & {
      captureStream?: (frameRate?: number) => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const captured =
      typeof v.captureStream === 'function'
        ? v.captureStream()
        : v.mozCaptureStream?.() ?? null;
    if (!captured || captured.getTracks().length === 0) {
      return { blob: null, failure: 'no_capture_stream' };
    }

    const audioTracks = captured.getAudioTracks();
    if (audioTracks.length === 0 && captured.getVideoTracks().length === 0) {
      captured.getTracks().forEach((t) => t.stop());
      return { blob: null, failure: 'no_audio_track' };
    }

    const recordStream =
      audioTracks.length > 0 ? new MediaStream(audioTracks) : captured;

    const pickMime = (audioOnly: boolean): string | null => {
      const candidates = audioOnly
        ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'video/webm;codecs=opus', 'video/webm']
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
    if (!mimeType) {
      captured.getTracks().forEach((t) => t.stop());
      return { blob: null, failure: 'no_mime' };
    }

    const chunks: Blob[] = [];
    const mr = new MediaRecorder(recordStream, {
      mimeType,
      audioBitsPerSecond: 64_000,
    });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });

    const seekTo = async (sec: number) => {
      if (sec <= 0.05) return;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        try {
          video.currentTime = sec;
        } catch {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }
      });
    };

    try {
      await seekTo(startSec);
      await video.play();
    } catch {
      try {
        await seekTo(0);
        await video.play();
      } catch {
        if (mr.state !== 'inactive') {
          try {
            mr.stop();
          } catch {
            /* ignore */
          }
        }
        captured.getTracks().forEach((t) => t.stop());
        return { blob: null, failure: 'play_blocked' };
      }
    }

    await new Promise((r) => setTimeout(r, 350));

    mr.start();

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
    captured.getTracks().forEach((t) => t.stop());
    await stopped;

    if (chunks.length === 0) {
      return { blob: null, failure: 'empty_recording' };
    }
    return { blob: new Blob(chunks, { type: mr.mimeType || mimeType }) };
  } catch {
    return { blob: null, failure: 'load_error' };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
