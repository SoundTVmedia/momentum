import { Capacitor } from '@capacitor/core';
import { ShazamKit, type ShazamKitMatchPayload } from '@feedback/shazamkit';
import {
  MAX_IDENTIFY_UPLOAD_BYTES,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '@/shared/identify-music-limits';
import { extractWavSnippetViaWebAudio } from '@/react-app/utils/identifyAudioSample';
import type { AudDIdentifyResult } from '@/react-app/utils/auddIdentify';

/** Cap for payloads sent over the Capacitor bridge as base64. */
export const SHAZAMKIT_MAX_DIRECT_BYTES = MAX_IDENTIFY_UPLOAD_BYTES;

const SHAZAMKIT_TIMEOUT_MS = 20_000;

/**
 * True on native iOS builds that ship the @feedback/shazamkit plugin.
 * Web, Android, and older TestFlight binaries return false (ACRCloud path).
 */
export function isShazamKitIdentifyAvailable(): boolean {
  try {
    return (
      Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ShazamKit')
    );
  } catch {
    return false;
  }
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
    audio.size >= MIN_IDENTIFY_SAMPLE_BYTES &&
    audio.size <= SHAZAMKIT_MAX_DIRECT_BYTES
  ) {
    return audio;
  }
  return null;
}

/** Whole-video bridge transfer is a last resort — only for small clips. */
export function canSendVideoDirectly(video: Blob): boolean {
  return (
    video.size >= MIN_IDENTIFY_SAMPLE_BYTES && video.size <= SHAZAMKIT_MAX_DIRECT_BYTES
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

async function recognizeShazamKitBlob(source: Blob): Promise<AudDIdentifyResult> {
  const base64 = await blobToBase64(source);
  const { match } = await withTimeout(
    ShazamKit.recognizeAudio({
      base64,
      mimeType: source.type || 'audio/mp4',
    }),
    SHAZAMKIT_TIMEOUT_MS,
  );
  return shazamKitMatchToIdentifyResult(match);
}

/**
 * Live mic segments (web MediaRecorder or native AAC): ShazamKit when the
 * plugin is present, otherwise null so the caller can use the Worker ACR path.
 */
export async function identifyLiveAudioWithShazamKit(
  audio: Blob,
): Promise<AudDIdentifyResult | null> {
  if (!isShazamKitIdentifyAvailable()) return null;
  const source = pickShazamKitMicSource(audio);
  if (!source) return null;
  try {
    return await recognizeShazamKitBlob(source);
  } catch (err) {
    console.warn('ShazamKit live identify failed', err);
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'ShazamKit recognition failed',
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
  if (!source) {
    source = await extractWavSnippetViaWebAudio(video);
  }
  if (!source && canSendVideoDirectly(video)) {
    source = video;
  }
  if (!source || source.size < MIN_IDENTIFY_SAMPLE_BYTES) return null;

  try {
    return await recognizeShazamKitBlob(source);
  } catch (err) {
    console.warn('ShazamKit identify failed', err);
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'ShazamKit recognition failed',
    };
  }
}
