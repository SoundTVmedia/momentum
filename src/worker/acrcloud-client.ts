import { createHmac } from 'node:crypto';

const IDENTIFY_PATH = '/v1/identify';
const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;
const ACRCLOUD_CONSOLE_URL = 'https://console.acrcloud.com/';

export type AcrCloudRecognizeResult = {
  artist: string;
  title: string;
  album?: string | null;
  /** 0–1 when ACRCloud returns a score (typically 0–100). */
  confidence?: number;
  isrc?: string | null;
};

export type AcrCloudRecognizeResponse =
  | { ok: true; match: AcrCloudRecognizeResult }
  | { ok: true; match: null; status: string }
  | { ok: false; error: string; acrcloud?: unknown };

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

function friendlyAcrCloudError(code: number | undefined, msg: string): string {
  switch (code) {
    case 1001:
      return 'No match in ACRCloud catalog for this audio.';
    case 3001:
      return `Invalid ACRCloud access key. Check ACRCLOUD_ACCESS_KEY in .dev.vars (${ACRCLOUD_CONSOLE_URL}).`;
    case 3003:
      return `ACRCloud request quota exceeded (code 3003). Upgrade or wait for reset — ${ACRCLOUD_CONSOLE_URL}`;
    case 3014:
      return `ACRCloud signature rejected (code 3014). Verify ACRCLOUD_ACCESS_SECRET and host match your project.`;
    case 3015:
      return `ACRCloud rate limit exceeded (code 3015). Slow live capture polling or upgrade your plan.`;
    default:
      return msg.trim() || 'ACRCloud returned an error';
  }
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

  const sampleBytes = file.size;
  if (sampleBytes === 0) {
    return { ok: false, error: 'Empty audio sample.' };
  }
  if (sampleBytes > MAX_SAMPLE_BYTES) {
    return {
      ok: false,
      error: `Audio sample too large for ACRCloud (max ${MAX_SAMPLE_BYTES} bytes).`,
    };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = buildSignature(accessKey, accessSecret, timestamp, 'audio');

  const form = new FormData();
  form.append('sample', file, filename);
  form.append('sample_bytes', String(sampleBytes));
  form.append('access_key', accessKey);
  form.append('data_type', 'audio');
  form.append('signature_version', '1');
  form.append('signature', signature);
  form.append('timestamp', timestamp);

  const url = `https://${host}${IDENTIFY_PATH}`;

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body: form });
  } catch (e) {
    console.error('[ACRCloud] network error', e);
    return { ok: false, error: 'Could not reach ACRCloud.' };
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'ACRCloud returned non-JSON.' };
  }

  if (!res.ok) {
    return { ok: false, error: `ACRCloud HTTP ${res.status}`, acrcloud: json };
  }

  const status = json.status;
  const code =
    status && typeof status === 'object'
      ? (status as { code?: unknown }).code
      : undefined;
  const statusCode = typeof code === 'number' ? code : undefined;
  const statusMsg =
    status && typeof status === 'object' && typeof (status as { msg?: unknown }).msg === 'string'
      ? ((status as { msg: string }).msg as string)
      : '';

  if (statusCode === 1001) {
    return { ok: true, match: null, status: 'no_match' };
  }

  if (statusCode !== undefined && statusCode !== 0) {
    return {
      ok: false,
      error: friendlyAcrCloudError(statusCode, statusMsg),
      acrcloud: json,
    };
  }

  const match = parseMatch(json);
  if (!match) {
    return { ok: true, match: null, status: 'no_match' };
  }

  return { ok: true, match };
}
