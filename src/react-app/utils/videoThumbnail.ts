/**
 * Extract one JPEG frame from a local video for use as a clip thumbnail.
 * Avoids all-black first frames (common with WebM/MP4 keyframes at t>0) by seeking
 * a few candidate offsets and picking the first frame that looks like real image data.
 */

function canvasSampleMeanLuminance(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const target = 4096;
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / target)));
  let sum = 0;
  let n = 0;
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return 0;
  }
  const d = data.data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

/** True if frame is almost certainly an encoder black / undecoded first frame. */
function isLikelyBlackFrame(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const mean = canvasSampleMeanLuminance(ctx, w, h);
  return mean < 10;
}

function clampSeek(t: number, duration: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return t;
  const margin = Math.min(0.05, duration / 200);
  return Math.min(t, Math.max(0, duration - margin));
}

function candidateSeekTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const raw = [
    0,
    Math.min(0.12, duration * 0.02),
    Math.min(0.35, duration * 0.06),
    Math.min(0.8, duration * 0.12),
    duration * 0.22,
    duration * 0.45,
  ].map((t) => clampSeek(t, duration));
  const out: number[] = [];
  const eps = 0.04;
  for (const t of raw) {
    if (!out.some((o) => Math.abs(o - t) < eps)) out.push(t);
  }
  return out.length ? out : [0];
}

async function seekVideoAndPaintFrame(video: HTMLVideoElement, t: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timerId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      resolve();
    }, 2500);
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      video.removeEventListener('seeked', onSeeked);
      reject(new Error('seek error'));
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onErr, { once: true });
    try {
      video.currentTime = t;
    } catch (e) {
      window.clearTimeout(timerId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      reject(e);
    }
  });
}

export async function generateVideoThumbnailJpeg(
  source: File | Blob,
  options?: { seekSeconds?: number; maxWidth?: number; quality?: number }
): Promise<File | null> {
  const explicitSeek = options?.seekSeconds;
  const maxWidth = options?.maxWidth ?? 720;
  const quality = options?.quality ?? 0.85;

  const url = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onerror = () => reject(new Error('video load error'));
      video.onloadedmetadata = () => resolve();
      video.src = url;
    });

    // Extra decode buffer helps Safari / WebM before seeking (reduces black first paint).
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = window.setTimeout(finish, 2000);
        video.addEventListener(
          'loadeddata',
          () => {
            window.clearTimeout(timer);
            finish();
          },
          { once: true }
        );
      });
    }

    const duration = video.duration;
    const durationOk = Number.isFinite(duration) && duration > 0;
    const seekPlan =
      explicitSeek !== undefined
        ? [
            clampSeek(
              explicitSeek,
              durationOk ? duration : Math.max(explicitSeek + 0.5, 1)
            ),
          ]
        : candidateSeekTimes(duration);

    const vw0 = video.videoWidth;
    const vh0 = video.videoHeight;
    if (!vw0 || !vh0) return null;

    const scale = Math.min(1, maxWidth / vw0);
    const cw = Math.round(vw0 * scale);
    const ch = Math.round(vh0 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    let bestBlob: Blob | null = null;

    for (const t of seekPlan) {
      try {
        await seekVideoAndPaintFrame(video, t);
      } catch {
        continue;
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(video, 0, 0, cw, ch);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      );
      if (!blob) continue;
      bestBlob = blob;

      const black = isLikelyBlackFrame(ctx, cw, ch);
      if (explicitSeek !== undefined || !black) {
        break;
      }
    }

    if (!bestBlob) return null;

    const name =
      source instanceof File
        ? `${source.name.replace(/\.[^.]+$/, '') || 'clip'}-thumb.jpg`
        : `clip-thumb-${Date.now()}.jpg`;
    return new File([bestBlob], name, { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
