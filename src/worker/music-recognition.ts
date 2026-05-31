import {
  isAcrCloudConfigured,
  recognizeMusicWithAcrCloud,
  type AcrCloudConfig,
} from './acrcloud-client';
import { recognizeMusicWithAudD, type AudDRecognizeResult } from './audd-client';

export type MusicRecognizeMatch = AudDRecognizeResult & {
  confidence?: number;
  isrc?: string | null;
};

export type MusicRecognizeResponse =
  | { ok: true; match: MusicRecognizeMatch }
  | { ok: true; match: null; status: string }
  | { ok: false; error: string; provider?: string; raw?: unknown };

type RecognizeEnv = {
  ACRCLOUD_HOST?: string;
  ACRCLOUD_ACCESS_KEY?: string;
  ACRCLOUD_ACCESS_SECRET?: string;
  AUDD_API_TOKEN?: string;
};

function acrConfigFromEnv(env: RecognizeEnv): AcrCloudConfig | null {
  const host = env.ACRCLOUD_HOST?.trim();
  const accessKey = env.ACRCLOUD_ACCESS_KEY?.trim();
  const accessSecret = env.ACRCLOUD_ACCESS_SECRET?.trim();
  if (!isAcrCloudConfigured({ host, accessKey, accessSecret })) return null;
  return { host: host!, accessKey: accessKey!, accessSecret: accessSecret! };
}

/**
 * Clip song ID: prefers ACRCloud when configured, otherwise AudD.
 */
export async function recognizeMusic(
  env: RecognizeEnv,
  file: File | Blob,
  filename: string,
): Promise<MusicRecognizeResponse> {
  const acr = acrConfigFromEnv(env);
  if (acr) {
    const out = await recognizeMusicWithAcrCloud(acr, file, filename);
    if (!out.ok) {
      return { ok: false, error: out.error, provider: 'acrcloud', raw: out.acrcloud };
    }
    if (!out.match) {
      return { ok: true, match: null, status: out.status ?? 'no_match' };
    }
    return {
      ok: true,
      match: {
        artist: out.match.artist,
        title: out.match.title,
        album: out.match.album ?? null,
        timecode: null,
        song_link: null,
        confidence: out.match.confidence,
        isrc: out.match.isrc ?? null,
      },
    };
  }

  const auddToken = env.AUDD_API_TOKEN?.trim();
  if (!auddToken) {
    return {
      ok: false,
      error:
        'Music recognition is not configured. Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, and ACRCLOUD_ACCESS_SECRET (or AUDD_API_TOKEN) in .dev.vars / Worker secrets.',
    };
  }

  const out = await recognizeMusicWithAudD(auddToken, file, filename);
  if (!out.ok) {
    return { ok: false, error: out.error, provider: 'audd', raw: out.audd };
  }
  if (!out.match) {
    return { ok: true, match: null, status: out.status ?? 'no_match' };
  }
  return { ok: true, match: out.match };
}

export function isMusicRecognitionConfigured(env: RecognizeEnv): boolean {
  return acrConfigFromEnv(env) != null || Boolean(env.AUDD_API_TOKEN?.trim());
}
