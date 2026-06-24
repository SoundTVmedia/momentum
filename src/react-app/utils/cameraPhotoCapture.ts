import { readCaptureDimensionsFromPreview } from '@/react-app/utils/cameraPreview';

/** Capture a still JPEG from the live camera preview or MediaStream track. */
export async function capturePhotoFromStream(
  stream: MediaStream,
  videoEl?: HTMLVideoElement | null,
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<Blob> {
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== 'live') {
    throw new Error('Camera track unavailable');
  }

  const ImageCaptureCtor = (
    globalThis as typeof globalThis & {
      ImageCapture?: new (track: MediaStreamTrack) => { takePhoto(): Promise<Blob> };
    }
  ).ImageCapture;

  if (ImageCaptureCtor) {
    try {
      const capture = new ImageCaptureCtor(track);
      const blob = await capture.takePhoto();
      if (blob.size > 0) return blob;
    } catch {
      /* fall through to canvas */
    }
  }

  const video = videoEl ?? document.createElement('video');
  const ownsVideo = !videoEl;
  if (ownsVideo) {
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => resolve(), 1500);
      video.onloadeddata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Preview not ready'));
      };
      void video.play().catch(() => undefined);
    });
  }

  if (!video.videoWidth || !video.videoHeight) {
    if (ownsVideo) {
      video.pause();
      video.srcObject = null;
    }
    throw new Error('Preview not ready');
  }

  const { width, height } = readCaptureDimensionsFromPreview(video, track, orientation);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (ownsVideo) {
      video.pause();
      video.srcObject = null;
    }
    throw new Error('Canvas unavailable');
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(width / vw, height / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const dx = (width - drawW) / 2;
  const dy = (height - drawH) / 2;
  ctx.drawImage(video, dx, dy, drawW, drawH);

  if (ownsVideo) {
    video.pause();
    video.srcObject = null;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Photo encode failed'))),
      'image/jpeg',
      0.92,
    );
  });
  return blob;
}

/** Encode a still photo as a short WebM so existing clip upload / Stream paths work unchanged. */
export async function photoBlobToStillVideoBlob(
  photo: Blob,
  durationMs = 400,
): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable');
  }

  const mimeCandidates = [
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  if (!mimeType) {
    bitmap.close();
    throw new Error('Video encoder unavailable');
  }

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      bitmap.close();
      if (chunks.length === 0) {
        reject(new Error('Empty video'));
        return;
      }
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      bitmap.close();
      reject(new Error('Video encode failed'));
    };
  });

  ctx.drawImage(bitmap, 0, 0);
  recorder.start(100);
  const started = Date.now();
  while (Date.now() - started < durationMs) {
    ctx.drawImage(bitmap, 0, 0);
    await new Promise((r) => window.setTimeout(r, 33));
  }
  recorder.stop();
  return done;
}
