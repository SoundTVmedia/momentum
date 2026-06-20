/** True when the preview element has decoded at least one video frame. */
export function cameraPreviewHasFrames(video: HTMLVideoElement): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0;
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  return ios && safari;
}

/** Apply attributes Safari/iOS need for inline muted camera preview. */
export function prepareCameraPreviewElement(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('muted', '');
  video.disablePictureInPicture = true;
}

/** Best-effort play() for muted inline camera previews. */
export async function kickCameraPreviewPlay(
  video: HTMLVideoElement,
  opts?: { waitForMetadata?: boolean },
): Promise<void> {
  prepareCameraPreviewElement(video);

  if (opts?.waitForMetadata && video.readyState < 1) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('loadedmetadata', finish);
        resolve();
      };
      const timer = window.setTimeout(finish, 1200);
      video.addEventListener('loadedmetadata', () => {
        window.clearTimeout(timer);
        finish();
      }, { once: true });
    });
  }

  // Safari often needs a paint tick before play() after srcObject assignment.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    await video.play();
  } catch {
    /* May require a user gesture on Safari / Chrome. */
  }
}

/** HTMLMediaElement.HAVE_CURRENT_DATA — inlined for non-DOM test runners. */
const HAVE_CURRENT_DATA = 2;

export type CameraPreviewReadyOptions = {
  /** Safari/iOS: require decoded pixels — readyState alone is unreliable. */
  strictFrames?: boolean;
};

/** Ready to hide the loading overlay. */
export function cameraPreviewLooksReady(
  video: HTMLVideoElement,
  opts?: CameraPreviewReadyOptions,
): boolean {
  if (cameraPreviewHasFrames(video)) return true;
  if (opts?.strictFrames) return false;
  return video.readyState >= HAVE_CURRENT_DATA;
}

/**
 * Kick decode during the user-gesture window (iOS Safari).
 * Detaches immediately — does not stop MediaStream tracks.
 */
export async function warmCameraStreamPreview(stream: MediaStream): Promise<void> {
  if (typeof document === 'undefined') return;
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState === 'ended') return;

  const video = document.createElement('video');
  prepareCameraPreviewElement(video);
  video.srcObject = stream;

  try {
    await kickCameraPreviewPlay(video, { waitForMetadata: isIosSafari() });
    if (isIosSafari()) {
      await new Promise((r) => window.setTimeout(r, 80));
    }
  } catch {
    /* best effort */
  } finally {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
}
