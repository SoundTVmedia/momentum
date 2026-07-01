/**
 * Hybrid native iOS capture: @capgo/camera-preview + @feedback/native-audio-capture.
 * Web and Android continue using getUserMedia / MediaRecorder.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { CameraPreview } from '@capgo/camera-preview';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { PluginListenerHandle } from '@capacitor/core';
import { NativeAudioCapture } from '@feedback/native-audio-capture';
import { getNativePlatform, isNativeApp } from '@/react-app/lib/native-bridge';

export const NATIVE_CAPTURE_MAX_SECONDS = 60;
export const NATIVE_LIVE_AUDD_SEGMENT_MS = 5_000;

export type NativeCaptureFacing = 'rear' | 'front';

export type NativeZoomState = {
  min: number;
  max: number;
  current: number;
  presets: number[];
};

let previewRunning = false;
let previewAudioEnabled = false;
let recordingActive = false;
let startPreviewPromise: Promise<void> | null = null;
let audioListener: PluginListenerHandle | null = null;
let onAudioSegmentHandler: ((blob: Blob) => void) | null = null;
/** Capgo adds AVCaptureMovieFileOutput on a background queue after preview start. */
const NATIVE_VIDEO_OUTPUT_READY_MS = 750;
let previewRecordingReadyAt = 0;

async function ensureNativeVideoOutputReady(): Promise<void> {
  const remaining = previewRecordingReadyAt - Date.now();
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export function shouldUseNativeIosCapture(): boolean {
  return isNativeApp() && getNativePlatform() === 'ios';
}

/** CSS viewport size for full-bleed native preview (differs from UIScreen bounds). */
export function readNativeCaptureViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }
  const width = Math.round(window.innerWidth);
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  return { width, height };
}

/**
 * Expand native preview to the full web viewport. Capgo defaults to a 4:3 letterboxed
 * frame with paddingBottom; controls are overlaid in the web layer instead.
 */
export async function applyNativeCaptureFullScreenPreview(): Promise<void> {
  if (!shouldUseNativeIosCapture() || !previewRunning) return;
  const { width, height } = readNativeCaptureViewportSize();
  try {
    await CameraPreview.setPreviewSize({ y: 0, width, height });
  } catch (err) {
    console.warn('applyNativeCaptureFullScreenPreview:', err);
  }
}

export async function startNativeCapturePreview(opts?: {
  facing?: NativeCaptureFacing;
  /** When false, preview starts without mic (no audio in recorded video). Default true. */
  withAudio?: boolean;
}): Promise<void> {
  if (!shouldUseNativeIosCapture()) return;
  const withAudio = opts?.withAudio !== false;

  if (previewRunning) {
    if (previewAudioEnabled === withAudio) {
      await applyNativeCaptureFullScreenPreview();
      return;
    }
    await stopNativeCaptureSession();
  }
  if (startPreviewPromise) {
    await startPreviewPromise;
    if (previewRunning && previewAudioEnabled === withAudio) {
      await applyNativeCaptureFullScreenPreview();
      return;
    }
    if (previewRunning && previewAudioEnabled !== withAudio) {
      await stopNativeCaptureSession();
    }
  }

  startPreviewPromise = (async () => {
    try {
      await CameraPreview.start({
        position: opts?.facing ?? 'rear',
        toBack: true,
        disableAudio: !withAudio,
        enableVideoMode: true,
        // iOS native plugin reads `cameraMode` (not enableVideoMode) to attach AVCaptureMovieFileOutput.
        cameraMode: true,
        paddingBottom: 0,
        positioning: 'top',
        rotateWhenOrientationChanged: true,
      } as Parameters<typeof CameraPreview.start>[0] & { cameraMode?: boolean });
      previewRecordingReadyAt = Date.now() + NATIVE_VIDEO_OUTPUT_READY_MS;
      await ensureNativeVideoOutputReady();
      await applyNativeCaptureFullScreenPreview();
      previewRunning = true;
      previewAudioEnabled = withAudio;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already started/i.test(message)) {
        previewRecordingReadyAt = Date.now() + NATIVE_VIDEO_OUTPUT_READY_MS;
        await ensureNativeVideoOutputReady();
        await applyNativeCaptureFullScreenPreview();
        previewRunning = true;
        previewAudioEnabled = withAudio;
        return;
      }
      throw err;
    } finally {
      startPreviewPromise = null;
    }
  })();

  await startPreviewPromise;
}

export async function stopNativeCaptureSession(): Promise<void> {
  await stopNativeLiveAudioSegments();
  if (recordingActive) {
    try {
      await CameraPreview.stopRecordVideo();
    } catch {
      /* ignore */
    }
    recordingActive = false;
  }
  if (previewRunning) {
    try {
      await CameraPreview.stop();
    } catch {
      /* ignore */
    }
    previewRunning = false;
  }
  previewRecordingReadyAt = 0;
  previewAudioEnabled = false;
}

export function isNativeCapturePreviewRunning(): boolean {
  return previewRunning;
}

export async function readNativeZoomState(): Promise<NativeZoomState | null> {
  if (!previewRunning) return null;
  try {
    const [zoom, buttons] = await Promise.all([
      CameraPreview.getZoom(),
      CameraPreview.getZoomButtonValues(),
    ]);
    return {
      min: zoom.min,
      max: zoom.max,
      current: zoom.current,
      presets: buttons.values.length >= 2 ? buttons.values : [zoom.min, zoom.max],
    };
  } catch (err) {
    console.warn('readNativeZoomState:', err);
    return null;
  }
}

export async function setNativeCaptureZoom(level: number): Promise<void> {
  if (!previewRunning) return;
  await CameraPreview.setZoom({ level, autoFocus: true });
}

export async function flipNativeCamera(): Promise<void> {
  if (!previewRunning || recordingActive) return;
  await CameraPreview.flip();
}

export async function captureNativePhoto(): Promise<Blob> {
  const result = await CameraPreview.capture({ quality: 90, format: 'jpeg' });
  const value = result.value;
  if (value.startsWith('file://') || value.startsWith('/')) {
    const url = Capacitor.convertFileSrc(value);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to read native photo');
    return response.blob();
  }
  const base64 = value.includes(',') ? (value.split(',')[1] ?? value) : value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/jpeg' });
}

export async function startNativeVideoRecording(): Promise<void> {
  if (!previewRunning || recordingActive) return;
  await ensureNativeVideoOutputReady();
  await CameraPreview.startRecordVideo({
    disableAudio: false,
    storeToFile: true,
  });
  recordingActive = true;
}

export async function stopNativeVideoRecording(): Promise<{ videoFilePath: string }> {
  if (!recordingActive) {
    throw new Error('Native video recording is not active');
  }
  const result = await CameraPreview.stopRecordVideo();
  recordingActive = false;
  return { videoFilePath: result.videoFilePath };
}

export async function startNativeLiveAudioSegments(
  onSegment: (blob: Blob) => void,
  segmentDurationMs = NATIVE_LIVE_AUDD_SEGMENT_MS,
): Promise<void> {
  if (!shouldUseNativeIosCapture()) return;
  onAudioSegmentHandler = onSegment;
  await stopNativeLiveAudioSegments();
  audioListener = await NativeAudioCapture.addListener('audioSegment', (event) => {
    if (!onAudioSegmentHandler) return;
    try {
      const binary = atob(event.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: event.mimeType || 'audio/mp4' });
      onAudioSegmentHandler(blob);
    } catch (err) {
      console.warn('startNativeLiveAudioSegments decode:', err);
    }
  });
  await NativeAudioCapture.start({ segmentDurationMs });
}

export async function stopNativeLiveAudioSegments(): Promise<void> {
  onAudioSegmentHandler = null;
  try {
    await NativeAudioCapture.stop();
  } catch {
    /* ignore */
  }
  if (audioListener) {
    try {
      await audioListener.remove();
    } catch {
      /* ignore */
    }
    audioListener = null;
  }
  try {
    await NativeAudioCapture.removeAllListeners();
  } catch {
    /* ignore */
  }
}

export async function nativeVideoPathToBlob(filePath: string): Promise<Blob> {
  const trimmed = filePath.trim();
  if (!trimmed) {
    throw new Error('Native video path is empty');
  }

  // Brief pause so AVCaptureMovieFileOutput can flush the file to disk.
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const url = Capacitor.convertFileSrc(trimmed);
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        return blob;
      }
    }
  } catch (err) {
    console.warn('nativeVideoPathToBlob fetch:', err);
  }

  const readCandidates: Array<{ path: string; directory?: Directory }> = [];
  const pathPart = trimmed.replace(/^file:\/\//, '');
  const fileName = pathPart.split('/').pop();
  if (fileName) {
    readCandidates.push({ path: fileName, directory: Directory.Documents });
    readCandidates.push({ path: fileName, directory: Directory.Cache });
  }
  readCandidates.push({ path: trimmed });
  readCandidates.push({ path: pathPart });
  readCandidates.push({ path: decodeURIComponent(pathPart) });

  for (const candidate of readCandidates) {
    if (!candidate.path) continue;
    try {
      const read = await Filesystem.readFile({
        path: candidate.path,
        ...(candidate.directory ? { directory: candidate.directory } : {}),
      });
      let bytes: Uint8Array;
      if (typeof read.data === 'string') {
        const binary = atob(read.data);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
      } else {
        bytes = new Uint8Array(await read.data.arrayBuffer());
      }
      const blob = new Blob([bytes], { type: 'video/mp4' });
      if (blob.size > 0) {
        return blob;
      }
    } catch {
      /* try next path form */
    }
  }

  throw new Error(`Failed to read native video at ${filePath}`);
}

export async function nativeCaptureHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (!shouldUseNativeIosCapture()) {
    if ('vibrate' in navigator) navigator.vibrate(50);
    return;
  }
  const impact =
    style === 'heavy'
      ? ImpactStyle.Heavy
      : style === 'medium'
        ? ImpactStyle.Medium
        : ImpactStyle.Light;
  try {
    await Haptics.impact({ style: impact });
  } catch {
    if ('vibrate' in navigator) navigator.vibrate(50);
  }
}

export async function nativeCaptureWarningHaptic(): Promise<void> {
  if (!shouldUseNativeIosCapture()) {
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    return;
  }
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
    await new Promise((r) => setTimeout(r, 50));
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
  }
}
