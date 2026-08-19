import * as FileSystem from 'expo-file-system/legacy';
import { apiFetch } from '@/src/lib/api/client';
import {
  identifySampleByteLength,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '@shared/identify-music-limits';
import {
  errorOutcome,
  matchedOutcome,
  noMatchOutcome,
  normalizeAcrCloudIdentifyMatch,
  shouldFallBackToAcrCloud,
  unavailableOutcome,
  type MusicRecognitionOutcome,
} from '@/src/lib/music/recognition';
import {
  isShazamKitAvailable,
  recognizeSongFromVideo,
} from '@/src/lib/music/shazamkit';

const IDENTIFY_FETCH_TIMEOUT_MS = 22_000;

/**
 * Recognize the song in a pending capture. ShazamKit (on-device, iOS 15+)
 * is the primary provider; the Worker's ACRCloud endpoint is the fallback
 * when ShazamKit is unavailable or returns no match / an error.
 * Never throws — callers get an outcome and uploading is never blocked.
 */
export async function recognizeSongForCapture(input: {
  videoUri: string;
  fileSize: number;
  contentType: string;
}): Promise<MusicRecognitionOutcome> {
  const shazamKitAvailable = isShazamKitAvailable();
  let shazamKitStatus: 'no_match' | 'error' | null = null;
  let shazamKitError: string | null = null;

  if (shazamKitAvailable) {
    try {
      const match = await recognizeSongFromVideo(input.videoUri);
      if (match) return matchedOutcome(match);
      shazamKitStatus = 'no_match';
    } catch (err) {
      shazamKitStatus = 'error';
      shazamKitError = err instanceof Error ? err.message : 'ShazamKit recognition failed';
    }
  }

  if (!shouldFallBackToAcrCloud({ shazamKitAvailable, shazamKitStatus })) {
    // Unreachable today (matched returns early), kept for clarity.
    return noMatchOutcome('shazamkit');
  }

  const fallback = await identifyMusicViaWorker(input);

  if (fallback.status === 'matched') return fallback;
  if (fallback.status === 'no_match') {
    return noMatchOutcome(shazamKitStatus ? 'shazamkit' : fallback.provider);
  }
  // Fallback errored or is unavailable — surface the primary attempt when it ran.
  if (shazamKitStatus === 'no_match') return noMatchOutcome('shazamkit');
  if (shazamKitStatus === 'error') {
    return errorOutcome('shazamkit', shazamKitError ?? 'ShazamKit recognition failed');
  }
  return fallback;
}

/**
 * ACRCloud fallback: post the first ~12s of the recorded file (byte-scaled
 * head, same budget as the Worker superadmin path) to
 * `/api/clips/identify-music`.
 */
async function identifyMusicViaWorker(input: {
  videoUri: string;
  fileSize: number;
  contentType: string;
}): Promise<MusicRecognitionOutcome> {
  if (input.fileSize > 0 && input.fileSize < MIN_IDENTIFY_SAMPLE_BYTES) {
    return noMatchOutcome('acrcloud');
  }

  const sampleBytes = identifySampleByteLength({ fileSize: input.fileSize });
  let snippetUri: string | null = null;
  try {
    let uploadUri = input.videoUri;
    if (input.fileSize > sampleBytes) {
      snippetUri = await writeHeadSnippet(input.videoUri, sampleBytes);
      uploadUri = snippetUri;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: uploadUri,
      name: 'clip-snippet.m4a',
      type: input.contentType || 'video/mp4',
      // React Native FormData file part — not a DOM Blob.
    } as unknown as Blob);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IDENTIFY_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await apiFetch('/api/clips/identify-music', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      return errorOutcome('acrcloud', 'Too many song lookups — wait a moment and try again.');
    }

    const data = (await res.json()) as {
      ok?: boolean;
      skipped?: boolean;
      match?: unknown;
      error?: string;
      message?: string;
    };

    if (data.skipped) {
      // Worker has no ACRCloud credentials configured.
      return unavailableOutcome();
    }
    if (!res.ok || data.ok === false) {
      return errorOutcome(
        'acrcloud',
        typeof data.error === 'string' && data.error ? data.error : 'Song lookup failed',
      );
    }

    const match = normalizeAcrCloudIdentifyMatch(data);
    if (!match) return noMatchOutcome('acrcloud');
    return matchedOutcome(match);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return errorOutcome('acrcloud', 'Song lookup timed out — try again or enter the song manually.');
    }
    return errorOutcome(
      'acrcloud',
      err instanceof Error ? err.message : 'Song lookup failed',
    );
  } finally {
    if (snippetUri) {
      void FileSystem.deleteAsync(snippetUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

/** Copy the first `length` bytes of the recording into a temp file (~12s). */
async function writeHeadSnippet(videoUri: string, length: number): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(videoUri, {
    encoding: FileSystem.EncodingType.Base64,
    position: 0,
    length,
  });
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('No writable directory for the song ID snippet.');
  }
  const snippetUri = `${dir}identify-snippet-${Date.now()}.mp4`;
  await FileSystem.writeAsStringAsync(snippetUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return snippetUri;
}
