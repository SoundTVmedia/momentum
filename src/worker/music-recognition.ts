import {
  isAcrCloudConfigured,
  recognizeMusicWithAcrCloud,
  type AcrCloudRecognizeResponse,
  type AcrCloudRecognizeResult,
  type AcrCloudConfig,
} from './acrcloud-client';
import { recognizeMusicWithAudD, type AudDRecognizeResult } from './audd-client';

export type MusicRecognizeMatch = AudDRecognizeResult & {
  confidence?: number;
  isrc?: string | null;
};

export type MusicRecognizeResponse =
  | { ok: true; match: MusicRecognizeMatch; provider: 'acrcloud' | 'audd' }
  | {
      ok: true;
      match: null;
      status: string;
      provider: 'acrcloud' | 'audd';
      acrcloudCode?: number;
      skippedReason?: string;
    }
  | { ok: false; error: string; provider?: string; acrcloudCode?: number; raw?: unknown };

type RecognizeEnv = {
  ACRCLOUD_HOST?: string;
  ACRCLOUD_ACCESS_KEY?: string;
  ACRCLOUD_ACCESS_SECRET?: string;
  AUDD_API_TOKEN?: string;
};

export type MusicRecognitionConfigStatus = {
  activeProvider: 'acrcloud' | 'audd' | 'none';
  acrcloud: {
    host: string | null;
    accessKeyConfigured: boolean;
    accessSecretConfigured: boolean;
    ready: boolean;
  };
  audd: { ready: boolean };
  /** When ACR is primary, AudD can still run on retriable ACR failures. */
  auddFallbackAvailable: boolean;
  hint: string | null;
};

function acrConfigFromEnv(env: RecognizeEnv): AcrCloudConfig | null {
  const host = env.ACRCLOUD_HOST?.trim();
  const accessKey = env.ACRCLOUD_ACCESS_KEY?.trim();
  const accessSecret = env.ACRCLOUD_ACCESS_SECRET?.trim();
  if (!isAcrCloudConfigured({ host, accessKey, accessSecret })) return null;
  return { host: host!, accessKey: accessKey!, accessSecret: accessSecret! };
}

export function describeMusicRecognitionConfig(env: RecognizeEnv): MusicRecognitionConfigStatus {
  const host = env.ACRCLOUD_HOST?.trim() ?? '';
  const accessKey = env.ACRCLOUD_ACCESS_KEY?.trim() ?? '';
  const accessSecret = env.ACRCLOUD_ACCESS_SECRET?.trim() ?? '';
  const acrReady = isAcrCloudConfigured({ host, accessKey, accessSecret });
  const auddReady = Boolean(env.AUDD_API_TOKEN?.trim());

  let hint: string | null = null;
  if (host && (!accessKey || !accessSecret)) {
    hint =
      'ACRCLOUD_HOST is set but access key or secret is missing. In production set all three via wrangler secret put (Dashboard → Workers → Settings → Variables).';
  } else if (!acrReady && !auddReady) {
    hint = 'No music recognition credentials loaded on this Worker.';
  } else if (acrReady && !auddReady) {
    hint =
      'ACRCloud only — attach "ACRCloud Music" bucket in console (not empty custom). Optional: AUDD_API_TOKEN for fallback.';
  } else if (acrReady) {
    hint =
      'If every identify returns no match (ACR 1001), confirm "ACRCloud Music" bucket is attached in console.acrcloud.com.';
  }

  return {
    activeProvider: acrReady ? 'acrcloud' : auddReady ? 'audd' : 'none',
    acrcloud: {
      host: host || null,
      accessKeyConfigured: Boolean(accessKey),
      accessSecretConfigured: Boolean(accessSecret),
      ready: acrReady,
    },
    audd: { ready: auddReady },
    auddFallbackAvailable: acrReady && auddReady,
    hint,
  };
}

/** Infer upload filename so ACR skips valid non-WebM blobs and WebM rules apply correctly. */
export function inferIdentifyFilename(blob: Blob, rawName?: string): string {
  const name = rawName?.trim() ?? '';
  if (name) return name;
  const t = (blob.type ?? '').toLowerCase();
  if (t.includes('quicktime') || t.includes('mp4') || t.includes('aac')) return 'snippet.m4a';
  if (t.includes('mpeg') || t.includes('mp3')) return 'snippet.mp3';
  if (t.includes('webm')) return 'snippet.webm';
  if (t.includes('wav')) return 'snippet.wav';
  return 'snippet.bin';
}

/** When ACR fails transiently, try AudD if configured (improves production consistency). */
export function shouldFallbackAcrToAudd(
  acr: AcrCloudRecognizeResponse,
  auddConfigured: boolean,
): boolean {
  if (!auddConfigured) return false;
  if (!acr.ok) {
    const code = acr.acrcloudCode;
    if (code === 3001 || code === 3002 || code === 3014) return false;
    if (code === 3003) return true;
    if (code === 2004 || code === 3015) return true;
    return true;
  }
  if (!acr.match) {
    // Only retry via AudD when the sample was too small — not on catalog miss (1001).
    return acr.skippedReason === 'fragment_too_short';
  }
  return false;
}

function auddMatchToResponse(match: AudDRecognizeResult): MusicRecognizeMatch {
  return {
    artist: match.artist,
    title: match.title,
    album: match.album ?? null,
    timecode: match.timecode ?? null,
    song_link: match.song_link ?? null,
    confidence: undefined,
    isrc: null,
  };
}

function acrMatchToResponse(match: AcrCloudRecognizeResult): MusicRecognizeMatch {
  return {
    artist: match.artist,
    title: match.title,
    album: match.album ?? null,
    timecode: null,
    song_link: null,
    confidence: match.confidence,
    isrc: match.isrc ?? null,
  };
}

/**
 * Clip song ID: prefers ACRCloud when configured; optional AudD fallback on retriable ACR failures.
 */
export async function recognizeMusic(
  env: RecognizeEnv,
  file: File | Blob,
  filename: string,
): Promise<MusicRecognizeResponse> {
  const auddToken = env.AUDD_API_TOKEN?.trim();
  const acr = acrConfigFromEnv(env);

  if (acr) {
    const out = await recognizeMusicWithAcrCloud(acr, file, filename);

    if (shouldFallbackAcrToAudd(out, Boolean(auddToken))) {
      const acrFallbackDetail = !out.ok
        ? `acrError=${out.error}`
        : 'skippedReason' in out
          ? `skippedReason=${out.skippedReason ?? 'none'}`
          : 'acr_no_match';
      console.warn('[music-recognition] ACR fallback to AudD', acrFallbackDetail);
      const auddOut = await recognizeMusicWithAudD(auddToken!, file, filename);
      if (auddOut.ok && auddOut.match) {
        return { ok: true, match: auddMatchToResponse(auddOut.match), provider: 'audd' };
      }
      if (auddOut.ok && !auddOut.match) {
        return { ok: true, match: null, status: auddOut.status ?? 'no_match', provider: 'audd' };
      }
    }

    if (!out.ok) {
      return {
        ok: false,
        error: out.error,
        provider: 'acrcloud',
        acrcloudCode: out.acrcloudCode,
        raw: out.acrcloud,
      };
    }
    if (!out.match) {
      return {
        ok: true,
        match: null,
        status: out.status ?? 'no_match',
        provider: 'acrcloud',
        acrcloudCode: out.acrcloudCode,
        skippedReason: out.skippedReason,
      };
    }
    return { ok: true, match: acrMatchToResponse(out.match), provider: 'acrcloud' };
  }

  if (!auddToken) {
    return {
      ok: false,
      error:
        'Music recognition is not configured. Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET (or AUDD_API_TOKEN) on the Worker.',
    };
  }

  const out = await recognizeMusicWithAudD(auddToken, file, filename);
  if (!out.ok) {
    return { ok: false, error: out.error, provider: 'audd', raw: out.audd };
  }
  if (!out.match) {
    return { ok: true, match: null, status: out.status ?? 'no_match', provider: 'audd' };
  }
  return { ok: true, match: auddMatchToResponse(out.match), provider: 'audd' };
}

export function isMusicRecognitionConfigured(env: RecognizeEnv): boolean {
  return describeMusicRecognitionConfig(env).activeProvider !== 'none';
}
