const AUDD_RECOGNIZE_URL = 'https://api.audd.io/';

export type AudDRecognizeResult = {
  artist: string;
  title: string;
  album?: string | null;
  timecode?: string | null;
  song_link?: string | null;
};

export type AudDRecognizeResponse =
  | { ok: true; match: AudDRecognizeResult }
  | { ok: true; match: null; status: string; message?: string }
  | { ok: false; error: string; audd?: unknown };

/**
 * Standard recognition — send a short audio/video snippet (see AudD limits).
 * @see https://docs.audd.io/
 */
export async function recognizeMusicWithAudD(
  apiToken: string | undefined,
  file: File | Blob,
  filename: string
): Promise<AudDRecognizeResponse> {
  const token = typeof apiToken === 'string' ? apiToken.trim() : '';
  if (!token) {
    return { ok: false, error: 'AudD is not configured (missing AUDD_API_TOKEN).' };
  }

  const outgoing = new FormData();
  outgoing.set('api_token', token);
  outgoing.set('file', file, filename);

  let res: Response;
  try {
    res = await fetch(AUDD_RECOGNIZE_URL, {
      method: 'POST',
      body: outgoing,
    });
  } catch (e) {
    console.error('[AudD] network error', e);
    return { ok: false, error: 'Could not reach AudD.' };
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'AudD returned non-JSON.' };
  }

  if (!res.ok) {
    return { ok: false, error: `AudD HTTP ${res.status}`, audd: json };
  }

  const status = typeof json.status === 'string' ? json.status : 'unknown';
  if (status === 'error') {
    const raw = json.error;
    let msg = '';
    if (typeof raw === 'string') {
      msg = raw;
    } else if (typeof raw === 'number') {
      msg = `AudD error code ${raw}`;
    } else if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (typeof o.message === 'string') msg = o.message;
      else if (typeof o.error_message === 'string') msg = o.error_message;
      if (typeof o.error_code === 'number') {
        msg = msg.trim() ? `${msg.trim()} (code ${o.error_code})` : `AudD error code ${o.error_code}`;
      }
    }
    if (!msg.trim() && typeof json.result === 'string') {
      msg = json.result;
    }
    if (!msg.trim() && typeof json.msg === 'string') {
      msg = json.msg;
    }
    return { ok: false, error: msg.trim() || 'AudD returned an error', audd: json };
  }

  if (status !== 'success') {
    return { ok: false, error: `Unexpected AudD status: ${status}`, audd: json };
  }

  const result = json.result;
  if (result == null || (typeof result === 'object' && result !== null && !('artist' in result))) {
    return { ok: true, match: null, status: 'no_match' };
  }

  const r = result as Record<string, unknown>;
  const artist = typeof r.artist === 'string' ? r.artist.trim() : '';
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!artist && !title) {
    return { ok: true, match: null, status: 'no_match' };
  }

  return {
    ok: true,
    match: {
      artist,
      title,
      album: typeof r.album === 'string' ? r.album : null,
      timecode: typeof r.timecode === 'string' ? r.timecode : null,
      song_link: typeof r.song_link === 'string' ? r.song_link : null,
    },
  };
}
