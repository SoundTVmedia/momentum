/**
 * Extract one JPEG frame from a local video for use as a clip thumbnail.
 */
export async function generateVideoThumbnailJpeg(
  source: File | Blob,
  options?: { seekSeconds?: number; maxWidth?: number; quality?: number }
): Promise<File | null> {
  const seekSeconds = options?.seekSeconds ?? 0.25;
  const maxWidth = options?.maxWidth ?? 720;
  const quality = options?.quality ?? 0.85;

  const url = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onerror = () => reject(new Error('video load error'));
      video.onloadedmetadata = () => resolve();
      video.src = url;
    });

    const duration = video.duration;
    const t =
      Number.isFinite(duration) && duration > 0
        ? Math.min(Math.max(seekSeconds, 0), Math.max(0, duration - 0.05))
        : 0;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timerId: number | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timerId !== undefined) window.clearTimeout(timerId);
        resolve();
      };
      timerId = window.setTimeout(finish, 1200);
      video.addEventListener(
        'seeked',
        () => {
          finish();
        },
        { once: true }
      );
      video.addEventListener(
        'error',
        () => {
          if (settled) return;
          settled = true;
          if (timerId !== undefined) window.clearTimeout(timerId);
          reject(new Error('seek error'));
        },
        { once: true }
      );
      try {
        video.currentTime = t;
      } catch (e) {
        if (!settled) {
          settled = true;
          if (timerId !== undefined) window.clearTimeout(timerId);
          reject(e);
        }
      }
    });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const scale = Math.min(1, maxWidth / vw);
    const cw = Math.round(vw * scale);
    const ch = Math.round(vh * scale);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, cw, ch);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    if (!blob) return null;

    const name =
      source instanceof File
        ? `${source.name.replace(/\.[^.]+$/, '') || 'clip'}-thumb.jpg`
        : `clip-thumb-${Date.now()}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
