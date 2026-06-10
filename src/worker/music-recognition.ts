import {
  isAcrCloudConfigured,
  recognizeMusicWithAcrCloud,
  type AcrCloudRecognizeResult,
  type AcrCloudConfig,
} from './acrcloud-client';
import type { AudDRecognizeResult } from './audd-client';

export type MusicRecognizeMatch = AudDRecognizeResult & {
  confidence?: number;
  isrc?: string | null;
};

export type MusicRecognizeResponse =
  | { ok: true; match: MusicRecognizeMatch; provider: 'acrcloud' }
  | {
      ok: true;
      match: null;
      status: string;
      provider: 'acrcloud';
      acrcloudCode?: number;
      skippedReason?: string;
    }
  | { ok: false; error: string; provider?: 'acrcloud'; acrcloudCode?: number; raw?: unknown };

type RecognizeEnv = {
  ACRCLOUD_HOST?: string;
  ACRCLOUD_ACCESS_KEY?: string;
  ACRCLOUD_ACCESS_SECRET?: string;
  AUDD_API_TOKEN?: string;
};

export type MusicRecognitionConfigStatus = {
  activeProvider: 'acrcloud' | 'none';
  acrcloud: {
    host: string | null;
    accessKeyConfigured: boolean;
    accessSecretConfigured: boolean;
    ready: boolean;
  };
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

  let hint: string | null = null;
  if (host && (!accessKey || !accessSecret)) {
    hint =
      'ACRCLOUD_HOST is set but access key or secret is missing. In production set all three via wrangler secret put (Dashboard → Workers → Settings → Variables).';
  } else if (!acrReady) {
    hint =
      'Song ID uses ACRCloud only. Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET on the Worker.';
  }

  return {
    activeProvider: acrReady ? 'acrcloud' : 'none',
    acrcloud: {
      host: host || null,
      accessKeyConfigured: Boolean(accessKey),
      accessSecretConfigured: Boolean(accessSecret),
      ready: acrReady,
    },
    hint,
  };
}

/** Infer upload filename so ACR skips valid non-WebM blobs and WebM rules apply correctly. */
export function inferIdentifyFilename(blob: Blob, rawName?: string): string {
  const name = rawName?.trim() ?? '';
  if (name) return name;
  const t = (blob.type ?? '').toLowerCase();
  if (t.includes('quicktime') || t.includes('mp4') || t.includes('aac') || t.includes('caf')) {
    return 'snippet.m4a';
  }
  if (t.includes('mpeg') || t.includes('mp3')) return 'snippet.mp3';
  if (t.includes('webm')) return 'snippet.webm';
  if (t.includes('wav')) return 'snippet.wav';
  return 'snippet.bin';
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

/** Clip song ID via ACRCloud only. */
export async function recognizeMusic(
  env: RecognizeEnv,
  file: File | Blob,
  filename: string,
): Promise<MusicRecognizeResponse> {
  const acr = acrConfigFromEnv(env);

  if (!acr) {
    return {
      ok: false,
      error:
        'Song ID is not configured. Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET on the Worker.',
      provider: 'acrcloud',
    };
  }

  const out = await recognizeMusicWithAcrCloud(acr, file, filename);

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

export function isMusicRecognitionConfigured(env: RecognizeEnv): boolean {
  return describeMusicRecognitionConfig(env).activeProvider !== 'none';
}
