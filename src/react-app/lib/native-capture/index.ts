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
import { deviceIsPortraitViewport } from '@/react-app/utils/cameraPreview';
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
let previewLayoutTimer: ReturnType<typeof setTimeout> | null = null;
let previewLayoutInFlight = false;
let lastPreviewLayoutKey = '';
/** Capgo adds AVCaptureMovieFileOutput on a background queue after preview start. */
const NATIVE_VIDEO_OUTPUT_READY_MS = 1000;
let previewRecordingReadyAt = 0;
let previewStartGeneration = 0;

async function ensureNativeVideoOutputReady(): Promise<void> {
  const remaining = previewRecordingReadyAt - Date.now();
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

/** Reset AVAudioSession for video recording — required before each clip after playback restore. */
async function ensureNativeCaptureAudioReady(): Promise<void> {
  if (!shouldUseNativeIosCapture()) return;
  // Capgo owns the session while preview is running — re-preparing breaks movie audio mux.
  if (previewRunning) return;
  try {
    await NativeAudioCapture.prepareForVideoCapture();
    console.log('[native-capture] prepareForVideoCapture ok');
  } catch (err) {
    console.warn('ensureNativeCaptureAudioReady:', err);
  }
}

/** Public alias — call before reopening the camera for clip 2+ in a session. */
export async function prepareNativeCaptureRecordingAudio(): Promise<void> {
  await ensureNativeCaptureAudioReady();
}

const NATIVE_CAPTURE_SESSION_SETTLE_MS = 450;

/** Wait for AVAudioSession / capture stack to settle between clips. */
export async function settleNativeCaptureSession(ms = NATIVE_CAPTURE_SESSION_SETTLE_MS): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const nativeBlobReadInflight = new Map<string, Promise<Blob | null>>();

/** Wait until in-flight native file reads finish before reopening the camera. */
export async function waitForNativeCaptureIdle(maxMs = 12_000): Promise<void> {
  const started = Date.now();
  while (nativeBlobReadInflight.size > 0 && Date.now() - started < maxMs) {
    await Promise.all([...nativeBlobReadInflight.values()]);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

async function runCameraPreviewStart(
  withAudio: boolean,
  generation: number,
  opts?: { facing?: NativeCaptureFacing },
): Promise<void> {
  if (generation !== previewStartGeneration) return;
  if (withAudio) {
    await ensureNativeCaptureAudioReady();
  }
  if (generation !== previewStartGeneration) return;
  const { width, height } = readNativeCaptureViewportSize();
  const startOpts = {
    position: opts?.facing ?? 'rear',
    toBack: true,
    enableVideoMode: true,
    cameraMode: true,
    enableAudio: withAudio,
    width,
    height,
    paddingBottom: 0,
    positioning: 'top' as const,
    rotateWhenOrientationChanged: true,
    ...(withAudio ? {} : { disableAudio: true }),
  } as Parameters<typeof CameraPreview.start>[0] & { cameraMode?: boolean; enableAudio?: boolean };
  await CameraPreview.start(startOpts);
  if (generation !== previewStartGeneration) {
    await forceStopNativeCaptureSession();
    return;
  }
  previewRecordingReadyAt = Date.now() + NATIVE_VIDEO_OUTPUT_READY_MS;
  await ensureNativeVideoOutputReady();
  if (generation !== previewStartGeneration) {
    await forceStopNativeCaptureSession();
    return;
  }
  previewRunning = true;
  previewAudioEnabled = withAudio;
  // Layout after movie output + mic are wired — setPreviewSize must not run before audio is ready.
  await layoutNativeCapturePreview();
  if (generation !== previewStartGeneration) {
    await forceStopNativeCaptureSession();
    return;
  }
}

async function layoutNativeCapturePreview(): Promise<void> {
  const { width, height } = readNativeCaptureViewportSize();
  const layoutKey = `${width}x${height}`;
  if (layoutKey === lastPreviewLayoutKey && !previewLayoutInFlight) return;
  lastPreviewLayoutKey = layoutKey;
  previewLayoutInFlight = true;
  try {
    await CameraPreview.setPreviewSize({ width, height });
  } catch (err) {
    console.warn('layoutNativeCapturePreview:', err);
    lastPreviewLayoutKey = '';
  } finally {
    previewLayoutInFlight = false;
  }
}

/** Capgo aspect string for the current device orientation. */
export function nativeCaptureAspectRatio(): string {
  // Capgo inverts this for portrait (16:9 → tall 9:16 frame). Passing 9:16 yields a wide letterbox.
  return '16:9';
}

export function nativeCaptureOrientation(): 'portrait' | 'landscape' {
  return deviceIsPortraitViewport() ? 'portrait' : 'landscape';
}

export function shouldUseNativeIosCapture(): boolean {
  return isNativeApp() && getNativePlatform() === 'ios';
}

/** CSS viewport size for full-bleed native preview (differs from UIScreen bounds). */
export function readNativeCaptureViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  // Match the capture modal (100dvh) — use the tallest applicable height so the native
  // layer covers the full screen and does not leave a black strip at the bottom.
  const height = Math.round(
    Math.max(vv?.height ?? 0, window.innerHeight, document.documentElement.clientHeight),
  );
  return { width, height };
}

/**
 * Expand native preview to the full web viewport. Capgo defaults to a 4:3 letterboxed
 * frame with paddingBottom; controls are overlaid in the web layer instead.
 */
export async function applyNativeCaptureFullScreenPreview(): Promise<void> {
  if (!shouldUseNativeIosCapture() || !previewRunning) return;
  await layoutNativeCapturePreview();
}

/** Debounced layout sync — avoids flicker from rapid setPreviewSize / transparency passes. */
export function scheduleNativeCaptureFullScreenPreview(): void {
  if (!shouldUseNativeIosCapture() || !previewRunning) return;
  if (previewLayoutTimer) clearTimeout(previewLayoutTimer);
  previewLayoutTimer = setTimeout(() => {
    previewLayoutTimer = null;
    void applyNativeCaptureFullScreenPreview();
  }, 200);
}

export async function startNativeCapturePreview(opts?: {
  facing?: NativeCaptureFacing;
  /** When false, preview starts without mic (no audio in recorded video). Default true. */
  withAudio?: boolean;
}): Promise<void> {
  if (!shouldUseNativeIosCapture()) return;
  const withAudio = opts?.withAudio !== false;

  // Always tear down the prior session — partial reuse breaks mic muxing on clip 2+.
  if (previewRunning || startPreviewPromise) {
    await stopNativeCaptureSession();
    await settleNativeCaptureSession();
  } else if (withAudio) {
    await ensureNativeCaptureAudioReady();
  }

  const generation = ++previewStartGeneration;
  startPreviewPromise = (async () => {
    try {
      await runCameraPreviewStart(withAudio, generation, opts);
    } catch (err) {
      if (generation !== previewStartGeneration) return;
      const message = err instanceof Error ? err.message : String(err);
      if (/already started/i.test(message)) {
        try {
          await CameraPreview.stop();
        } catch {
          /* ignore */
        }
        previewRunning = false;
        previewAudioEnabled = false;
        await settleNativeCaptureSession();
        await runCameraPreviewStart(withAudio, generation, opts);
        return;
      }
      throw err;
    } finally {
      startPreviewPromise = null;
    }
  })();

  await startPreviewPromise;
}

/** Cancel an in-flight preview start (e.g. user closed capture before init finished). */
export function invalidateNativeCapturePreview(): void {
  previewStartGeneration += 1;
}

let restorePlaybackInFlight: Promise<void> | null = null;
let lastRestorePlaybackAt = 0;
let lastRestorePlaybackOkAt = 0;

export async function restoreNativeMediaPlaybackAudio(): Promise<void> {
  if (!shouldUseNativeIosCapture()) return;
  const now = Date.now();
  // Skip if a recent restore succeeded — camera stop + play tap cover the handoff.
  if (now - lastRestorePlaybackOkAt < 1500) return;
  if (restorePlaybackInFlight && now - lastRestorePlaybackAt < 1200) {
    return restorePlaybackInFlight;
  }
  lastRestorePlaybackAt = now;
  restorePlaybackInFlight = NativeAudioCapture.restoreForMediaPlayback()
    .then(() => {
      lastRestorePlaybackOkAt = Date.now();
    })
    .catch((err) => {
      console.warn('restoreNativeMediaPlaybackAudio:', err);
    });
  try {
    await restorePlaybackInFlight;
  } finally {
    restorePlaybackInFlight = null;
  }
}

/** Capacitor file URL for in-app preview — WKWebView plays audio reliably vs blob URLs. */
export function nativeCapturePreviewVideoUrl(nativeVideoPath: string | null | undefined): string | null {
  const path = nativeVideoPath?.trim();
  if (!path || !shouldUseNativeIosCapture()) return null;
  return Capacitor.convertFileSrc(path);
}

export function isBlobObjectUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith('blob:'));
}

/** Prefer native file src on iOS; fall back to an existing blob object URL. */
export function resolveCapturePreviewVideoSrc(opts: {
  blobObjectUrl?: string | null;
  nativeVideoPath?: string | null;
}): string | null {
  return nativeCapturePreviewVideoUrl(opts.nativeVideoPath) ?? opts.blobObjectUrl ?? null;
}

/** Always attempt native teardown — safe when previewRunning is false or init is still in flight. */
export async function forceStopNativeCaptureSession(opts?: {
  /** Switch to playback category for feed/caption video — omit when handing off to the next clip. */
  restorePlayback?: boolean;
}): Promise<void> {
  invalidateNativeCapturePreview();
  if (recordingActive) {
    try {
      await CameraPreview.stopRecordVideo();
    } catch {
      /* ignore */
    }
    recordingActive = false;
  }
  previewRunning = false;
  previewAudioEnabled = false;
  previewRecordingReadyAt = 0;
  if (previewLayoutTimer) {
    clearTimeout(previewLayoutTimer);
    previewLayoutTimer = null;
  }
  lastPreviewLayoutKey = '';
  try {
    await CameraPreview.stop();
  } catch {
    /* not initialized / already stopped */
  }
  if (opts?.restorePlayback) {
    await restoreNativeMediaPlaybackAudio();
  }
}

export async function stopNativeCaptureSession(opts?: {
  restorePlayback?: boolean;
}): Promise<void> {
  await forceStopNativeCaptureSession(opts);
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
  await applyNativeCaptureFullScreenPreview();
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
  // Capgo captureVideo() owns the recording audio session — do not call
  // NativeAudioCapture.prepareForVideoCapture here; setActive(false) breaks muxing.
  await ensureNativeVideoOutputReady();
  // Capacitor drops `false` booleans — omit disableAudio when mic is on (native defaults to audio in cameraMode).
  await CameraPreview.startRecordVideo(
    (previewAudioEnabled
      ? { storeToFile: true, enableAudio: true }
      : { storeToFile: true, disableAudio: true }) as Parameters<typeof CameraPreview.startRecordVideo>[0] & {
      enableAudio?: boolean;
    },
  );
  recordingActive = true;
}

export async function stopNativeVideoRecording(): Promise<{
  videoFilePath: string;
  audioTrackCount?: number;
}> {
  if (!recordingActive) {
    throw new Error('Native video recording is not active');
  }
  const result = (await CameraPreview.stopRecordVideo()) as {
    videoFilePath: string;
    audioTrackCount?: number;
  };
  recordingActive = false;
  const audioTrackCount = result.audioTrackCount ?? 0;
  if (previewAudioEnabled && audioTrackCount < 1) {
    throw new Error('Recorded video has no audio track');
  }
  return {
    videoFilePath: result.videoFilePath,
    audioTrackCount,
  };
}

/** True when native stopRecordVideo reported at least one muxed audio track. */
export function nativeRecordingHasRequiredAudio(audioTrackCount?: number | null): boolean {
  return (audioTrackCount ?? 0) >= 1;
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

function blobLikelyHasAudio(bytes: Uint8Array): boolean {
  try {
    return captureVideoBlobLikelyHasAudio(bytes);
  } catch (err) {
    console.warn('captureVideoBlobLikelyHasAudio:', err);
    return true;
  }
}

function detectRecordedVideoMime(bytes: Uint8Array): string {
  if (bytes.length >= 8) {
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp === 'qt  ') return 'video/quicktime';
  }
  return 'video/mp4';
}

function bytesContainPattern(bytes: Uint8Array, pattern: string): boolean {
  if (pattern.length === 0 || bytes.length < pattern.length) return false;
  const first = pattern.charCodeAt(0);
  const lastIndex = bytes.length - pattern.length;
  for (let i = 0; i <= lastIndex; i += 1) {
    if (bytes[i] !== first) continue;
    let matched = true;
    for (let j = 1; j < pattern.length; j += 1) {
      if (bytes[i + j] !== pattern.charCodeAt(j)) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/** Heuristic: MP4/MOV contains an audio sample description (mp4a/soun/esds). */
export function nativeVideoBlobLikelyHasAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 32) return false;
  const patterns = ['mp4a', 'soun', 'aac ', 'aac\0', 'esds', 'alac', 'ec-3', 'ac-3', 'samr', 'twos'];
  const scanLen = Math.min(bytes.length, 2 * 1024 * 1024);
  const regions =
    bytes.length <= scanLen
      ? [bytes]
      : [bytes.subarray(0, scanLen), bytes.subarray(bytes.length - scanLen)];
  return patterns.some((pattern) => regions.some((region) => bytesContainPattern(region, pattern)));
}

/** MP4/MOV or WebM capture blob heuristics — used to block silent clip handoffs. */
export function captureVideoBlobLikelyHasAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 32) return false;
  const scanLen = Math.min(bytes.length, 512 * 1024);
  const head = bytes.subarray(0, scanLen);
  const webmPatterns = ['A_OPUS', 'A_VORBIS', 'OpusHead', 'A_AAC'];
  if (webmPatterns.some((pattern) => bytesContainPattern(head, pattern))) {
    return true;
  }
  return nativeVideoBlobLikelyHasAudio(bytes);
}

export async function assertCaptureBlobHasAudio(
  blob: Blob,
  opts?: {
    nativeAudioTrackCount?: number | null;
    /** Web MediaRecorder started with live mic tracks — skip byte heuristics. */
    webStreamHadAudio?: boolean;
  },
): Promise<void> {
  if (nativeRecordingHasRequiredAudio(opts?.nativeAudioTrackCount)) {
    return;
  }
  // Browser capture (incl. mobile Safari): mic was requested at getUserMedia / record start.
  if (!shouldUseNativeIosCapture()) {
    return;
  }
  const scanLen = Math.min(blob.size, 2 * 1024 * 1024);
  const head = new Uint8Array(await blob.slice(0, scanLen).arrayBuffer());
  if (captureVideoBlobLikelyHasAudio(head)) {
    return;
  }
  if (blob.size > scanLen) {
    const tail = new Uint8Array(await blob.slice(blob.size - scanLen).arrayBuffer());
    if (captureVideoBlobLikelyHasAudio(tail)) {
      return;
    }
  }
  throw new Error('Recorded video has no audio track');
}

async function decodeFilesystemReadData(data: string | Blob): Promise<Uint8Array> {
  if (typeof data === 'string') {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(await data.arrayBuffer());
}

async function fetchNativeVideoBlobFromUrl(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

async function readNativeVideoBytesFromFilesystem(
  filePath: string,
): Promise<Uint8Array | null> {
  const readCandidates = nativeVideoFileCandidates(filePath);
  for (const candidate of readCandidates) {
    if (!candidate.path) continue;
    try {
      const read = await Filesystem.readFile({
        path: candidate.path,
        ...(candidate.directory ? { directory: candidate.directory } : {}),
      });
      const bytes = await decodeFilesystemReadData(read.data);
      if (bytes.length > 0) return bytes;
    } catch {
      /* try next path form */
    }
  }
  return null;
}

async function fetchNativeVideoBlobViaUri(filePath: string): Promise<Blob | null> {
  const pathPart = filePath.trim().replace(/^file:\/\//, '');
  const fileName = pathPart.split('/').pop();
  if (!fileName) return null;

  const uriCandidates: Array<{ directory: Directory; path: string }> = [
    { directory: Directory.Documents, path: fileName },
  ];

  for (const candidate of uriCandidates) {
    try {
      const uriResult = await Filesystem.getUri({
        directory: candidate.directory,
        path: candidate.path,
      });
      const blob = await fetchNativeVideoBlobFromUrl(Capacitor.convertFileSrc(uriResult.uri));
      if (blob?.size) return blob;
    } catch {
      /* try next */
    }
  }
  return null;
}

function nativeVideoFileCandidates(
  filePath: string,
): Array<{ path: string; directory?: Directory }> {
  const trimmed = filePath.trim();
  const pathPart = trimmed.replace(/^file:\/\//, '');
  const fileName = pathPart.split('/').pop();
  const candidates: Array<{ path: string; directory?: Directory }> = [];
  if (fileName) {
    candidates.push({ path: fileName, directory: Directory.Documents });
  }
  candidates.push({ path: trimmed });
  candidates.push({ path: pathPart });
  candidates.push({ path: decodeURIComponent(pathPart) });
  return candidates;
}

/** Wait until AVCaptureMovieFileOutput finishes writing (size stable). */
async function waitForNativeVideoFileReady(filePath: string, maxMs = 8000): Promise<void> {
  if (!shouldUseNativeIosCapture()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  const statCandidates = nativeVideoFileCandidates(filePath).filter((c) => c.directory);
  if (!statCandidates.length) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  const started = Date.now();
  let lastSize = -1;
  let stableAt = 0;

  while (Date.now() - started < maxMs) {
    for (const candidate of statCandidates) {
      try {
        const stat = await Filesystem.stat({
          path: candidate.path,
          directory: candidate.directory!,
        });
        const size = stat.size ?? 0;
        if (size > 1024) {
          if (size === lastSize) {
            if (Date.now() - stableAt >= 600) return;
          } else {
            lastSize = size;
            stableAt = Date.now();
          }
        }
      } catch {
        /* file not ready yet */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

export async function resolveNativeCaptureUploadBlob(
  nativeVideoPath: string | null | undefined,
  fallback?: Blob | null,
  opts?: { requireAudio?: boolean; nativeAudioTrackCount?: number | null },
): Promise<Blob | null> {
  if (!nativeVideoPath?.trim() || !shouldUseNativeIosCapture()) {
    return fallback?.size ? fallback : null;
  }
  const requireAudio = opts?.requireAudio === true;
  const nativeAudioOk = nativeRecordingHasRequiredAudio(opts?.nativeAudioTrackCount);
  if (nativeAudioOk && fallback?.size) {
    return fallback;
  }

  const pathKey = nativeVideoPath.trim();
  const existing = nativeBlobReadInflight.get(pathKey);
  if (existing) {
    return existing;
  }

  const readPromise = (async (): Promise<Blob | null> => {
    try {
      await waitForNativeVideoFileReady(pathKey);
      const blob = await nativeVideoPathToBlob(pathKey, {
        requireAudio: requireAudio && !nativeAudioOk,
      });
      if (blob.size > 0) return blob;
    } catch (err) {
      console.warn('resolveNativeCaptureUploadBlob:', err);
    }
    if (requireAudio && !nativeAudioOk && fallback?.size) {
      try {
        const bytes = new Uint8Array(await fallback.arrayBuffer());
        if (blobLikelyHasAudio(bytes)) return fallback;
      } catch {
        /* ignore */
      }
      return null;
    }
    return fallback?.size ? fallback : null;
  })();

  nativeBlobReadInflight.set(pathKey, readPromise);
  try {
    return await readPromise;
  } finally {
    if (nativeBlobReadInflight.get(pathKey) === readPromise) {
      nativeBlobReadInflight.delete(pathKey);
    }
  }
}

export async function nativeVideoPathToBlob(
  filePath: string,
  opts?: { requireAudio?: boolean },
): Promise<Blob> {
  const trimmed = filePath.trim();
  if (!trimmed) {
    throw new Error('Native video path is empty');
  }

  const requireAudio = opts?.requireAudio === true;
  const maxAttempts = requireAudio ? 4 : 1;

  let lastBlob: Blob | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await waitForNativeVideoFileReady(trimmed, 4000);
    }

    const fromUri = await fetchNativeVideoBlobViaUri(trimmed);
    if (fromUri?.size) {
      lastBlob = fromUri;
      if (!requireAudio) return fromUri;
      const bytes = new Uint8Array(await fromUri.arrayBuffer());
      if (blobLikelyHasAudio(bytes)) return fromUri;
    }

    try {
      const url = Capacitor.convertFileSrc(trimmed);
      const fromFetch = await fetchNativeVideoBlobFromUrl(url);
      if (fromFetch?.size) {
        lastBlob = fromFetch;
        if (!requireAudio) return fromFetch;
        const bytes = new Uint8Array(await fromFetch.arrayBuffer());
        if (blobLikelyHasAudio(bytes)) return fromFetch;
      }
    } catch (err) {
      console.warn('nativeVideoPathToBlob fetch:', err);
    }

    const bytes = await readNativeVideoBytesFromFilesystem(trimmed);
    if (bytes?.length) {
      const blob = new Blob([bytes], { type: detectRecordedVideoMime(bytes) });
      lastBlob = blob;
      if (!requireAudio || blobLikelyHasAudio(bytes)) {
        return blob;
      }
    }
  }

  if (lastBlob?.size && !requireAudio) return lastBlob;
  if (lastBlob?.size && requireAudio) {
    throw new Error('Native video file has no audio track');
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
