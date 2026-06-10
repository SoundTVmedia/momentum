import { createHmac } from 'node:crypto';
import {
  ACR_MAX_SAMPLE_BYTES,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '../shared/identify-music-limits';

const IDENTIFY_PATH = '/v1/identify';
const MAX_SAMPLE_BYTES = ACR_MAX_SAMPLE_BYTES;
const MIN_WEBM_BYTES_FOR_IDENTIFY = MIN_IDENTIFY_SAMPLE_BYTES;
const ACRCLOUD_CONSOLE_URL = 'https://console.acrcloud.com/';

export type AcrCloudRecognizeResult = {
  artist: string;
  title: string;
  album?: string | null;
  confidence?: number;
  isrc?: string | null;
};

export type AcrCloudRecognizeResponse =
  | { ok: true; match: AcrCloudRecognizeResult }
  | { ok: true; match: null; status: string; acrcloudCode?: number; skippedReason?: string }
  | { ok: false; error: string; acrcloudCode?: number; acrcloud?: unknown };

export type AcrCloudConfig = {
  host: string;
  accessKey: string;
  accessSecret: string;
};

function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

export function isAcrCloudConfigured(cfg: Partial<AcrCloudConfig> | undefined): boolean {
  if (!cfg) return false;
  return Boolean(
    cfg.host?.trim() && cfg.accessKey?.trim() && cfg.accessSecret?.trim(),
  );
}

function buildSignature(
  accessKey: string,
  accessSecret: string,
  timestamp: string,
  dataType: 'audio',
): string {
  const stringToSign = [
    'POST',
    IDENTIFY_PATH,
    accessKey,
    dataType,
    '1',
    timestamp,
  ].join('\n');
  return createHmac('sha1', accessSecret).update(stringToSign, 'utf8').digest('base64');
}

function acrStatusFromJson(json: Record<string, unknown>): {
  code?: number;
  msg: string;
} {
  const status = json.status;
  if (!status || typeof status !== 'object') return { msg: '' };
  const o = status as { code?: unknown; msg?: unknown };
  const code = typeof o.code === 'number' ? o.code : undefined;
  const msg = typeof o.msg === 'string' ? o.msg : '';
  return { code, msg };
}

function friendlyAcrCloudError(code: number | undefined, msg: string): string {
  switch (code) {
    case 1001:
      return (
        'No match in ACRCloud catalog for this audio (code 1001). Record 8+ seconds of clear music from the speakers. ' +
        'If every clip fails (even known songs), confirm your access keys and host are from the same AVR project ' +
        'that has the "ACRCloud Music" bucket attached in console.acrcloud.com.'
      );
    case 2004:
      return 'ACRCloud could not fingerprint this audio (code 2004). Record a few more seconds with clear music, or use a longer clip.';
    case 3001:
      return `Invalid ACRCloud access key (code 3001). Set ACRCLOUD_ACCESS_KEY in .dev.vars for local dev, or wrangler secret put for production (${ACRCLOUD_CONSOLE_URL}).`;
    case 3002:
      return `Invalid ACRCloud request (code 3002). ${msg || 'Check host matches your project region.'}`;
    case 3003:
      return `ACRCloud request quota exceeded (code 3003). Upgrade or wait for reset — ${ACRCLOUD_CONSOLE_URL}`;
    case 3014:
      return `ACRCloud signature rejected (code 3014). Verify ACRCLOUD_ACCESS_SECRET and that ACRCLOUD_HOST matches your project (e.g. identify-us-west-2.acrcloud.com).`;
    case 3015:
      return `ACRCloud rate limit exceeded (code 3015). Slow live capture polling or upgrade your plan.`;
    default:
      return msg.trim() ? `${msg.trim()}${code != null ? ` (code ${code})` : ''}` : 'ACRCloud returned an error';
  }
}

function hasWebmEbmlHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

function looksLikeWebm(bytes: Uint8Array, filename: string): boolean {
  const name = filename.toLowerCase();
  if (name.endsWith('.webm') || name.endsWith('.weba')) return true;
  return hasWebmEbmlHeader(bytes);
}

function looksLikeWav(bytes: Uint8Array, filename: string): boolean {
  const name = filename.toLowerCase();
  if (name.endsWith('.wav')) return true;
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  );
}

function looksLikeMp4Family(bytes: Uint8Array, filename: string): boolean {
  const name = filename.toLowerCase();
  if (name.endsWith('.m4a') || name.endsWith('.mp4') || name.endsWith('.aac') || name.endsWith('.caf')) {
    return true;
  }
  return (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

function shouldSkipFragmentedWebm(bytes: Uint8Array, filename: string): boolean {
  if (looksLikeWav(bytes, filename) || looksLikeMp4Family(bytes, filename)) return false;
  if (!looksLikeWebm(bytes, filename)) return false;
  if (bytes.byteLength < MIN_WEBM_BYTES_FOR_IDENTIFY) return true;
  if (!hasWebmEbmlHeader(bytes)) return true;
  return false;
}

function parseMatch(json: Record<string, unknown>): AcrCloudRecognizeResult | null {
  const metadata = json.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const music = (metadata as { music?: unknown }).music;
  if (!Array.isArray(music) || music.length === 0) return null;

  const top = music[0];
  if (!top || typeof top !== 'object') return null;
  const m = top as Record<string, unknown>;

  const title = typeof m.title === 'string' ? m.title.trim() : '';
  let artist = '';
  const artists = m.artists;
  if (Array.isArray(artists) && artists[0] && typeof artists[0] === 'object') {
    const name = (artists[0] as { name?: unknown }).name;
    if (typeof name === 'string') artist = name.trim();
  }
  if (!title && !artist) return null;

  let album: string | null = null;
  const albumObj = m.album;
  if (albumObj && typeof albumObj === 'object') {
    const albumName = (albumObj as { name?: unknown }).name;
    if (typeof albumName === 'string' && albumName.trim()) album = albumName.trim();
  }

  let confidence: number | undefined;
  if (typeof m.score === 'number' && Number.isFinite(m.score)) {
    confidence = Math.min(1, Math.max(0, m.score / 100));
  }

  let isrc: string | null = null;
  const extIds = m.external_ids;
  if (extIds && typeof extIds === 'object') {
    const isrcVal = (extIds as { isrc?: unknown }).isrc;
    if (typeof isrcVal === 'string' && isrcVal.trim()) isrc = isrcVal.trim();
  }

  return { artist, title, album, confidence, isrc };
}

/**
 * [ACRCloud Identification API](https://docs.acrcloud.com/reference/identification-api/identification-api) — multipart audio upload.
 */
export async function recognizeMusicWithAcrCloud(
  config: AcrCloudConfig,
  file: File | Blob,
  filename: string,
): Promise<AcrCloudRecognizeResponse> {
  const host = normalizeHost(config.host);
  const accessKey = config.accessKey.trim();
  const accessSecret = config.accessSecret.trim();
  if (!host || !accessKey || !accessSecret) {
    return { ok: false, error: 'ACRCloud is not configured (host, access key, and secret required).' };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, error: 'Could not read audio sample.' };
  }

  let sampleBytes = bytes.byteLength;
  if (sampleBytes === 0) {
    return { ok: false, error: 'Empty audio sample.' };
  }
  if (sampleBytes > MAX_SAMPLE_BYTES) {
    console.warn(
      `[ACRCloud] Trimming sample from ${sampleBytes} to ${MAX_SAMPLE_BYTES} bytes file=${filename}`,
    );
    bytes = bytes.slice(0, MAX_SAMPLE_BYTES);
    sampleBytes = bytes.byteLength;
  }

  const safeName =
    filename.trim() !== '' ? filename.trim() : 'snippet.bin';

  if (shouldSkipFragmentedWebm(bytes, safeName)) {
    return {
      ok: true,
      match: null,
      status: 'no_match',
      skippedReason: 'fragment_too_short',
      acrcloudCode: undefined,
    };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = buildSignature(accessKey, accessSecret, timestamp, 'audio');

  const sampleBlob = new Blob([bytes], { type: 'application/octet-stream' });
  const sampleFile = new File([sampleBlob], safeName, { type: 'application/octet-stream' });

  const form = new FormData();
  form.append('sample', sampleFile);
  form.append('sample_bytes', String(sampleBytes));
  form.append('access_key', accessKey);
  form.append('data_type', 'audio');
  form.append('signature_version', '1');
  form.append('signature', signature);
  form.append('timestamp', timestamp);

  const url = `https://${host}${IDENTIFY_PATH}`;

  const ac = new AbortController();
  const acTimer = setTimeout(() => ac.abort(), 18_000);

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body: form, signal: ac.signal });
  } catch (e) {
    console.error('[ACRCloud] network error', e);
    const timedOut = e instanceof Error && e.name === 'AbortError';
    return {
      ok: false,
      error: timedOut
        ? 'ACRCloud timed out — try again or enter the song manually.'
        : 'Could not reach ACRCloud.',
    };
  } finally {
    clearTimeout(acTimer);
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'ACRCloud returned non-JSON.' };
  }

  const { code: statusCode, msg: statusMsg } = acrStatusFromJson(json);

  if (statusCode !== undefined) {
    console.log(
      `[ACRCloud] host=${host} http=${res.status} code=${statusCode} bytes=${sampleBytes} file=${safeName}`,
    );
  }

  if (!res.ok) {
    return {
      ok: false,
      error: friendlyAcrCloudError(statusCode, statusMsg || `ACRCloud HTTP ${res.status}`),
      acrcloudCode: statusCode,
      acrcloud: json,
    };
  }

  if (statusCode === 1001) {
    return { ok: true, match: null, status: 'no_match', acrcloudCode: 1001 };
  }

  if (statusCode !== undefined && statusCode !== 0) {
    return {
      ok: false,
      error: friendlyAcrCloudError(statusCode, statusMsg),
      acrcloudCode: statusCode,
      acrcloud: json,
    };
  }

  const match = parseMatch(json);
  if (!match) {
    console.warn(
      `[ACRCloud] code=${statusCode ?? 0} but empty metadata.music bytes=${sampleBytes} file=${safeName}`,
    );
    return { ok: true, match: null, status: 'no_match', acrcloudCode: statusCode };
  }

  return { ok: true, match };
}
