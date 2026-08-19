import { Capacitor } from '@capacitor/core';
import { ShazamKit, type ShazamKitMatchPayload } from '@feedback/shazamkit';
import {
  IDENTIFY_SAMPLE_SECONDS,
  IDENTIFY_SCAN_MAX_WINDOWS,
  IDENTIFY_SCAN_STEP_SECONDS,
  MAX_IDENTIFY_UPLOAD_BYTES,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '@/shared/identify-music-limits';
import { extractWavSnippetViaWebAudio } from '@/react-app/utils/identifyAudioSample';
import type { AudDIdentifyResult } from '@/react-app/utils/auddIdentify';

export type NativeFileIdentifyResult = AudDIdentifyResult & {
  wavPath?: string | null;
  loudestStartSeconds?: number | null;
  loudestRms?: number | null;
};

/** Cap for payloads sent over the Capacitor bridge as base64. */
export const SHAZAMKIT_MAX_DIRECT_BYTES = MAX_IDENTIFY_UPLOAD_BYTES;

const SHAZAMKIT_TIMEOUT_MS = 20_000;
/** Remote Stream MP4: AVAsset track load allows 45s natively. */
const SHAZAMKIT_REMOTE_FILE_TIMEOUT_MS = 50_000;
/** Overlapping 11s windows + one 202 retry per window. */
const SHAZAMKIT_SCAN_WINDOWS_TIMEOUT_MS = 120_000;

/**
 * When duration cannot be read, probe 11s windows every 8s until the file ends.
 * Native stops early once a later window has no audio left.
 */
export const SHAZAMKIT_UNKNOWN_DURATION_WINDOW_STARTS: number[] = Array.from(
  { length: IDENTIFY_SCAN_MAX_WINDOWS },
  (_, i) => i * IDENTIFY_SCAN_STEP_SECONDS,
);

/**
 * Overlapping 11s window starts that always include the last 11s when the
 * clip is longer than one signature. Three sparse points (start/mid/end)
 * miss songs that sit between those windows.
 */
export function shazamKitScanWindowStarts(durationSeconds: number | null | undefined): number[] {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return SHAZAMKIT_UNKNOWN_DURATION_WINDOW_STARTS.slice();
  }
  const window = IDENTIFY_SAMPLE_SECONDS;
  const lastStart = Math.max(0, durationSeconds - window);
  if (lastStart <= 1.5) return [0];
  const count = Math.min(
    IDENTIFY_SCAN_MAX_WINDOWS,
    Math.max(2, Math.round(lastStart / IDENTIFY_SCAN_STEP_SECONDS) + 1),
  );
  const step = lastStart / (count - 1);
  const starts: number[] = [];
  for (let i = 0; i < count; i += 1) {
    starts.push(i === count - 1 ? lastStart : i * step);
  }
  return starts;
}

/**
 * True on native iOS. Do not gate on Capacitor.isPluginAvailable('ShazamKit') —
 * custom local plugins are often missing from that map when the WebView is
 * loaded from server.url, which silently skipped every recognizeAudio call.
 */
export function isShazamKitIdentifyAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

let loggedAvailability = false;

/** One-shot console probe so device logs show whether the native plugin answers. */
export function logShazamKitAvailability(): void {
  if (loggedAvailability) return;
  loggedAvailability = true;
  try {
    console.log(
      '[shazamkit] native=',
      Capacitor.isNativePlatform(),
      'platform=',
      Capacitor.getPlatform(),
      'isPluginAvailable=',
      Capacitor.isPluginAvailable('ShazamKit'),
    );
  } catch (err) {
    console.warn('[shazamkit] availability probe failed', err);
  }
  void ShazamKit.isSupported()
    .then((r) => console.log('[shazamkit] isSupported', r))
    .catch((err) => console.warn('[shazamkit] isSupported failed', err));
}

/** Map the native plugin match payload onto the existing identify result shape. */
export function shazamKitMatchToIdentifyResult(
  match: ShazamKitMatchPayload | null | undefined,
): AudDIdentifyResult {
  const title = match?.title?.trim() ?? '';
  const artist = match?.artist?.trim() ?? '';
  if (!title && !artist) {
    return { status: 'nomatch', message: null };
  }
  const message =
    title && artist
      ? `Identified: ${title} — ${artist}`
      : `Identified: ${title || artist}`;
  const confidence =
    typeof match?.confidence === 'number' && Number.isFinite(match.confidence)
      ? match.confidence
      : undefined;
  return { status: 'match', artist, title, message, confidence };
}

/**
 * Prefer the parallel mic capture (clean AAC segments) when it fits the
 * bridge; otherwise callers fall back to a WebAudio WAV snippet of the video,
 * then the whole video when it is small enough to bridge.
 */
export function pickShazamKitMicSource(audio: Blob | null | undefined): Blob | null {
  if (
    audio &&
    audio.type.startsWith('audio/') &&
    isShazamKitDecodableOnIos(audio.type) &&
    audio.size >= MIN_IDENTIFY_SAMPLE_BYTES &&
    audio.size <= SHAZAMKIT_MAX_DIRECT_BYTES
  ) {
    return audio;
  }
  return null;
}

/**
 * AVFoundation cannot decode WebM/Opus/Ogg. Sending those to the native
 * plugin always failed with ERR_SHAZAMKIT_BAD_FILE.
 */
export function isShazamKitDecodableOnIos(mimeType: string | null | undefined): boolean {
  const t = (mimeType ?? '').toLowerCase();
  if (!t) return true;
  return !/webm|matroska|\bopus\b|\bogg\b/.test(t);
}

/** Whole-video bridge transfer is a last resort — only for small clips. */
export function canSendVideoDirectly(video: Blob): boolean {
  return (
    video.size >= MIN_IDENTIFY_SAMPLE_BYTES &&
    video.size <= SHAZAMKIT_MAX_DIRECT_BYTES &&
    isShazamKitDecodableOnIos(video.type)
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read audio blob'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('ShazamKit recognition timed out')),
      ms,
    );
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function isTransientShazamKitMatchFailure(err: unknown): boolean {
  const rec = err as { message?: string; errorMessage?: string } | null;
  const message = [err instanceof Error ? err.message : '', rec?.message, rec?.errorMessage]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(' ');
  // SHError 202 (matchAttemptFailed) is often transient. SHError 201 is an
  // invalid signature — retrying the same file cannot succeed.
  return /error 202/i.test(message);
}

async function recognizeShazamKitBlob(
  source: Blob,
  options?: { retryOnMatchFailure?: boolean },
): Promise<AudDIdentifyResult> {
  const base64 = await blobToBase64(source);
  const attempt = async () => {
    const { match } = await withTimeout(
      ShazamKit.recognizeAudio({
        base64,
        mimeType: source.type || 'audio/mp4',
      }),
      SHAZAMKIT_TIMEOUT_MS,
    );
    return shazamKitMatchToIdentifyResult(match);
  };

  try {
    return await attempt();
  } catch (err) {
    if (!options?.retryOnMatchFailure || !isTransientShazamKitMatchFailure(err)) {
      throw err;
    }
    await new Promise((r) => window.setTimeout(r, 1_200));
    return attempt();
  }
}

function describeUnknownError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const rec = err as { message?: string; errorMessage?: string; code?: string } | null;
  const msg = rec?.errorMessage || rec?.message || rec?.code;
  if (typeof msg === 'string' && msg.trim()) return msg;
  try {
    return JSON.stringify(err) || 'ShazamKit recognition failed';
  } catch {
    return 'ShazamKit recognition failed';
  }
}

/**
 * Identify from a native file path (Capgo recording) — avoids base64 of a 20–40MB movie.
 */
export async function identifyNativeFileWithShazamKit(
  path: string | null | undefined,
  options?: { scanWindows?: boolean },
): Promise<NativeFileIdentifyResult | null> {
  const trimmed = path?.trim() ?? '';
  if (!trimmed) return null;
  if (!isShazamKitIdentifyAvailable()) return null;
  const scanWindows = options?.scanWindows === true;
  const timeoutMs = scanWindows
    ? SHAZAMKIT_SCAN_WINDOWS_TIMEOUT_MS
    : /^https?:\/\//i.test(trimmed)
      ? SHAZAMKIT_REMOTE_FILE_TIMEOUT_MS
      : SHAZAMKIT_TIMEOUT_MS;
  const recognize = () =>
    ShazamKit.recognizeFile({
      path: trimmed,
      ...(scanWindows ? { scanWindows: true } : {}),
    });
  const logScan = (result: {
    match?: ShazamKitMatchPayload | null;
    windowsTried?: number;
    windowCount?: number;
    durationSeconds?: number | null;
    windowStarts?: number[];
    loudestStartSeconds?: number | null;
    loudestRms?: number | null;
    wavPath?: string | null;
  }) => {
    if (!scanWindows) return;
    console.log(
      '[identify] shazamkit scan',
      'duration=',
      result.durationSeconds ?? 'unknown',
      'starts=',
      result.windowStarts ?? [],
      'tried=',
      result.windowsTried ?? '?',
      'of',
      result.windowCount ?? '?',
      'loudest=',
      result.loudestStartSeconds ?? '?',
      'rms=',
      result.loudestRms ?? '?',
      result.match ? 'match' : 'nomatch',
    );
  };
  const withMeta = (
    identify: AudDIdentifyResult,
    result?: {
      wavPath?: string | null;
      loudestStartSeconds?: number | null;
      loudestRms?: number | null;
    },
  ): NativeFileIdentifyResult => ({
    ...identify,
    wavPath: result?.wavPath ?? null,
    loudestStartSeconds: result?.loudestStartSeconds ?? null,
    loudestRms: result?.loudestRms ?? null,
  });
  try {
    const result = await withTimeout(recognize(), timeoutMs);
    logScan(result);
    return withMeta(shazamKitMatchToIdentifyResult(result.match), result);
  } catch (err) {
    if (isTransientShazamKitMatchFailure(err)) {
      try {
        await new Promise((r) => window.setTimeout(r, 1_200));
        const result = await withTimeout(recognize(), timeoutMs);
        logScan(result);
        return withMeta(shazamKitMatchToIdentifyResult(result.match), result);
      } catch (retryErr) {
        console.warn('ShazamKit file identify failed', describeUnknownError(retryErr));
        return { status: 'error', message: describeUnknownError(retryErr) };
      }
    }
    console.warn('ShazamKit file identify failed', describeUnknownError(err));
    return { status: 'error', message: describeUnknownError(err) };
  }
}

/**
 * Live mic segments (web MediaRecorder or native AAC): ShazamKit when the
 * plugin is present, otherwise null so the caller can use the Worker ACR path.
 */
export async function identifyLiveAudioWithShazamKit(
  audio: Blob,
): Promise<AudDIdentifyResult | null> {
  if (!isShazamKitIdentifyAvailable()) return null;
  if (!isShazamKitDecodableOnIos(audio.type)) return null;
  let source = pickShazamKitMicSource(audio);
  if (!source) return null;
  const wav = await extractWavSnippetViaWebAudio(source);
  if (wav) source = wav;
  try {
    return await recognizeShazamKitBlob(source);
  } catch (err) {
    console.warn('ShazamKit live identify failed', describeUnknownError(err));
    return {
      status: 'error',
      message: describeUnknownError(err),
    };
  }
}

/**
 * Primary song ID pass: on-device ShazamKit on native iOS.
 * Returns null when ShazamKit is unavailable or no suitable audio source
 * could be prepared — callers continue with the ACRCloud ladder. A 'nomatch'
 * or 'error' result also falls through to ACRCloud in identifyMusicForClip.
 */
export async function identifyClipWithShazamKit(
  video: Blob,
  audio?: Blob | null,
): Promise<AudDIdentifyResult | null> {
  if (!isShazamKitIdentifyAvailable()) return null;

  let source = pickShazamKitMicSource(audio);
  if (source) {
    const wav = await extractWavSnippetViaWebAudio(source);
    if (wav) source = wav;
  }
  if (!source) {
    source = await extractWavSnippetViaWebAudio(video);
  }
  if (!source && canSendVideoDirectly(video) && video.type.toLowerCase().startsWith('audio/')) {
    source = video;
  }
  if (!source || source.size < MIN_IDENTIFY_SAMPLE_BYTES) return null;

  try {
    return await recognizeShazamKitBlob(source, { retryOnMatchFailure: true });
  } catch (err) {
    console.warn('ShazamKit identify failed', describeUnknownError(err));
    return {
      status: 'error',
      message: describeUnknownError(err),
    };
  }
}
