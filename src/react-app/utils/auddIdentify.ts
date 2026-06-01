import {
  ACR_MAX_SAMPLE_BYTES,
  MAX_IDENTIFY_UPLOAD_BYTES,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '@/shared/identify-music-limits';
import {
  extractMediaSnippetForAudDWithReason,
  type ExtractSnippetFailure,
} from '@/react-app/utils/extractMediaSnippetForAudD';
import {
  extractWavSnippetViaWebAudio,
  headSliceLikelyValid,
  sliceHeadForIdentify,
} from '@/react-app/utils/identifyAudioSample';

export function mergeSongTitleIntoCaption(current: string, title: string): string {
  const t = title.trim();
  if (!t) return current;
  const c = current.trim();
  if (!c) return t;
  if (c.includes(t)) return c;
  return `${t}\n\n${c}`;
}

export function auddSourceKey(source: Blob): string {
  return source instanceof File
    ? `file:${source.name}:${source.size}:${source.lastModified}`
    : `blob:${source.size}`;
}

export type AudDIdentifyResult =
  | {
      status: 'match';
      artist: string;
      title: string;
      message: string | null;
      /** 0–1 when the API exposes it; used by live stabilizer for faster confirmation. */
      confidence?: number;
    }
  | { status: 'skipped'; message?: string | null }
  | { status: 'nomatch'; message?: string | null }
  | { status: 'error'; message: string };

/** Serialized in router state after identify completes (before caption screen). */
export type AudDNavPrefill = {
  sourceKey: string;
  status: 'done' | 'skipped' | 'nomatch' | 'error';
  message: string | null;
  artist: string;
  title: string;
};

export type LiveSongSnapshot = { artist: string; title: string };

/**
 * Prefer the post-capture identify pass; fall back to a stabilized live match when the final pass misses.
 */
export function mergeLiveAndFinalSongIdentify(
  live: LiveSongSnapshot | null | undefined,
  final: AudDIdentifyResult,
): AudDIdentifyResult {
  if (final.status === 'match') {
    const artist = final.artist.trim();
    const title = final.title.trim();
    if (artist || title) return final;
  }
  if (final.status === 'skipped') return final;

  const snap = live
    ? { artist: live.artist.trim(), title: live.title.trim() }
    : { artist: '', title: '' };
  if (!snap.artist && !snap.title) return final;

  const message =
    snap.title && snap.artist
      ? `Identified: ${snap.title} — ${snap.artist}`
      : snap.title
        ? `Identified: ${snap.title}`
        : snap.artist
          ? `Identified: ${snap.artist}`
          : null;
  return {
    status: 'match',
    artist: snap.artist,
    title: snap.title,
    message,
  };
}

/** Build caption-screen prefill from stabilized live capture ID (no post-capture API wait). */
export function auddPrefillFromLiveMatch(
  sourceKey: string,
  live: LiveSongSnapshot | null | undefined,
): AudDNavPrefill {
  if (!live) {
    return { sourceKey, status: 'nomatch', message: null, artist: '', title: '' };
  }
  const artist = live.artist.trim();
  const title = live.title.trim();
  if (!artist && !title) {
    return { sourceKey, status: 'nomatch', message: null, artist: '', title: '' };
  }
  const message =
    title && artist
      ? `Identified: ${title} — ${artist}`
      : title
        ? `Identified: ${title}`
        : artist
          ? `Identified: ${artist}`
          : null;
  return { sourceKey, status: 'done', message, artist, title };
}

export function toAudDNavPrefill(sourceKey: string, r: AudDIdentifyResult): AudDNavPrefill {
  if (r.status === 'match') {
    return {
      sourceKey,
      status: 'done',
      message: r.message,
      artist: r.artist,
      title: r.title,
    };
  }
  if (r.status === 'skipped') {
    return {
      sourceKey,
      status: 'skipped',
      message: typeof r.message === 'string' && r.message.trim() !== '' ? r.message : null,
      artist: '',
      title: '',
    };
  }
  if (r.status === 'nomatch') {
    return { sourceKey, status: 'nomatch', message: null, artist: '', title: '' };
  }
  return { sourceKey, status: 'error', message: r.message, artist: '', title: '' };
}

/**
 * Short in-browser snippet → worker `/api/clips/identify-music` (ACRCloud or AudD).
 * Call after capture (before navigating to the caption screen) so fields can be prefilled for review.
 */
const MIN_SNIPPET_BYTES = MIN_IDENTIFY_SAMPLE_BYTES;

function identifyFilenameForBlob(blob: Blob): string {
  const t = (blob.type ?? '').toLowerCase();
  if (t.includes('wav')) return 'clip-snippet.wav';
  if (t.includes('quicktime') || t.includes('mp4') || t.includes('mpeg')) return 'clip-snippet.m4a';
  if (t.includes('webm')) return 'clip-snippet.webm';
  if (t.startsWith('audio/')) return 'clip-snippet.webm';
  return 'recording.webm';
}

function dedupeBlobs(blobs: Blob[]): Blob[] {
  const seen = new Set<string>();
  const out: Blob[] = [];
  for (const b of blobs) {
    const key = `${b.size}:${b.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/** Several strategies so large concert clips still yield a ≤5MB ACR-sized sample. */
async function buildVideoIdentifyCandidates(video: Blob): Promise<Blob[]> {
  const candidates: Blob[] = [];

  const mid = await extractMediaSnippetForAudDWithReason(video);
  if (mid.blob) candidates.push(mid.blob);

  const fromStart = await extractMediaSnippetForAudDWithReason(video, { preferStart: true });
  if (fromStart.blob) candidates.push(fromStart.blob);

  const wav = await extractWavSnippetViaWebAudio(video);
  if (wav) candidates.push(wav);

  const head = sliceHeadForIdentify(video);
  if (head && headSliceLikelyValid(video, head)) candidates.push(head);

  if (video.size >= MIN_SNIPPET_BYTES && video.size <= ACR_MAX_SAMPLE_BYTES) {
    candidates.push(video);
  }

  return dedupeBlobs(candidates);
}

function skippedMessageForExtractFailure(failure?: ExtractSnippetFailure): string {
  switch (failure) {
    case 'play_blocked':
      return 'Could not play this clip in the browser to extract audio. Try recording again in-app (not a screen recording).';
    case 'no_capture_stream':
    case 'no_audio_track':
      return 'This clip has no audio track we can read for song ID. Re-record with music audible in the video.';
    case 'no_mime':
    case 'unsupported':
      return 'Your browser cannot extract audio for song ID. Try Chrome/Safari latest, or a shorter clip.';
    case 'empty_recording':
      return 'Extracted audio was empty. Record at least 5 seconds with the PA clearly audible.';
    default:
      return 'Could not extract audio from this clip in the browser.';
  }
}

/** Resolve a single blob (mic audio or one candidate) for upload. */
async function resolveSnippetForIdentify(source: Blob): Promise<{
  snippet: Blob | null;
  extractFailure?: ExtractSnippetFailure;
}> {
  if (source.type.startsWith('audio/') && source.size >= MIN_SNIPPET_BYTES) {
    if (source.size <= ACR_MAX_SAMPLE_BYTES) return { snippet: source };
    const head = sliceHeadForIdentify(source);
    return head ? { snippet: head } : { snippet: source.slice(0, ACR_MAX_SAMPLE_BYTES) };
  }

  if (source.type.startsWith('audio/') && source.size > 0 && source.size < MIN_SNIPPET_BYTES) {
    return { snippet: null };
  }

  const { blob: extracted, failure } = await extractMediaSnippetForAudDWithReason(source);
  if (extracted && extracted.size >= MIN_SNIPPET_BYTES) {
    return { snippet: extracted };
  }

  const head = sliceHeadForIdentify(source);
  if (head && headSliceLikelyValid(source, head)) {
    return { snippet: head, extractFailure: failure };
  }

  if (source.size >= MIN_SNIPPET_BYTES && source.size <= ACR_MAX_SAMPLE_BYTES) {
    return { snippet: source, extractFailure: failure };
  }

  const wav = await extractWavSnippetViaWebAudio(source);
  if (wav && wav.size >= MIN_SNIPPET_BYTES) {
    return { snippet: wav, extractFailure: failure };
  }

  return { snippet: null, extractFailure: failure };
}

function pickStrongerMatch(a: AudDIdentifyResult, b: AudDIdentifyResult): AudDIdentifyResult {
  if (a.status === 'match' && b.status !== 'match') return a;
  if (b.status === 'match' && a.status !== 'match') return b;
  if (a.status === 'match' && b.status === 'match') {
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    return cb > ca ? b : a;
  }
  if (a.status === 'skipped') return b;
  if (b.status === 'skipped') return a;
  if (a.status === 'error' && b.status !== 'error') return b;
  if (b.status === 'error' && a.status !== 'error') return a;
  return a;
}

function isUsefulIdentifyResult(r: AudDIdentifyResult): boolean {
  return r.status === 'match' || r.status === 'error' || r.status === 'nomatch';
}

/**
 * Post-capture: mic audio first, then multiple video sampling strategies (large clips use first 5MB + WAV extract).
 */
export async function identifyMusicForClip(
  video: Blob,
  options?: { live?: LiveSongSnapshot | null; audio?: Blob | null },
): Promise<AudDIdentifyResult> {
  const live = options?.live;
  const audio = options?.audio;

  let best: AudDIdentifyResult = {
    status: 'skipped',
    message: 'Could not capture enough audio from this clip for song ID.',
  };

  if (audio && audio.size >= 1024) {
    const fromMic = await identifyMusicWithAudD(audio);
    best = pickStrongerMatch(best, fromMic);
    if (fromMic.status === 'match') {
      return mergeLiveAndFinalSongIdentify(live, fromMic);
    }
  }

  const candidates = await buildVideoIdentifyCandidates(video);
  for (const candidate of candidates) {
    const r = await postSnippetToIdentify(candidate);
    best = pickStrongerMatch(best, r);
    if (r.status === 'match') {
      return mergeLiveAndFinalSongIdentify(live, r);
    }
    if (r.status === 'error') {
      return mergeLiveAndFinalSongIdentify(live, r);
    }
  }

  if (!isUsefulIdentifyResult(best)) {
    const fallback = await identifyMusicWithAudD(video);
    best = pickStrongerMatch(best, fallback);
  }

  return mergeLiveAndFinalSongIdentify(live, best);
}

export async function identifyMusicWithAudD(source: Blob): Promise<AudDIdentifyResult> {
  const { snippet, extractFailure } = await resolveSnippetForIdentify(source);
  if (!snippet || snippet.size < MIN_SNIPPET_BYTES) {
    const extractHint = skippedMessageForExtractFailure(extractFailure);
    return {
      status: 'skipped',
      message:
        extractFailure != null
          ? extractHint
          : 'Could not capture enough audio from this clip for song ID (record at least 5s with clear music from the speakers).',
    };
  }
  return postSnippetToIdentify(snippet);
}

async function postSnippetToIdentify(snippet: Blob): Promise<AudDIdentifyResult> {
  if (snippet.size < MIN_SNIPPET_BYTES) {
    return {
      status: 'skipped',
      message: 'Audio sample was too small for song ID.',
    };
  }

  const uploadBlob =
    snippet.size > MAX_IDENTIFY_UPLOAD_BYTES
      ? snippet.slice(0, MAX_IDENTIFY_UPLOAD_BYTES)
      : snippet;

  try {
    const fd = new FormData();
    const fileName = identifyFilenameForBlob(uploadBlob);
    fd.set('file', uploadBlob, fileName);
    const res = await fetch('/api/clips/identify-music', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const data = (await res.json()) as {
      ok?: boolean;
      skipped?: boolean;
      match?: { artist?: string; title?: string; confidence?: number } | null;
      error?: string;
      message?: string;
      provider?: string;
      acrcloudCode?: number;
      skippedReason?: string;
      config?: { hint?: string | null; activeProvider?: string };
    };

    if (data.skipped) {
      const fromApi =
        typeof data.message === 'string' && data.message.trim() !== ''
          ? data.message.trim()
          : typeof data.config?.hint === 'string' && data.config.hint.trim() !== ''
            ? data.config.hint.trim()
            : null;
      return { status: 'skipped', message: fromApi };
    }
    if (res.status === 429) {
      return {
        status: 'error',
        message: 'Too many song lookups — wait a moment and try again.',
      };
    }
    if (!res.ok || data.ok === false) {
      const base = typeof data.error === 'string' ? data.error : 'Song lookup failed';
      const code =
        typeof data.acrcloudCode === 'number' && Number.isFinite(data.acrcloudCode)
          ? ` [ACR ${data.acrcloudCode}]`
          : '';
      const provider =
        typeof data.provider === 'string' && data.provider.trim() !== ''
          ? ` (${data.provider})`
          : '';
      return {
        status: 'error',
        message: `${base}${code}${provider}`,
      };
    }
    if (!data.match || (!data.match.artist && !data.match.title)) {
      const provider =
        typeof data.provider === 'string' && data.provider.trim() !== ''
          ? data.provider.trim()
          : null;
      const code =
        typeof data.acrcloudCode === 'number' && Number.isFinite(data.acrcloudCode)
          ? data.acrcloudCode
          : null;
      if (code === 1001) {
        return {
          status: 'nomatch',
          message:
            'ACRCloud heard the audio but found no song (code 1001). In console.acrcloud.com, attach the "ACRCloud Music" bucket to your project — an empty custom bucket causes this on every request.',
        };
      }
      const skipped =
        typeof (data as { skippedReason?: string }).skippedReason === 'string'
          ? (data as { skippedReason: string }).skippedReason
          : null;
      if (skipped === 'fragment_too_short') {
        return {
          status: 'nomatch',
          message:
            'Audio sample was too short to fingerprint. Record at least 8 seconds with clear music.',
        };
      }
      return {
        status: 'nomatch',
        message: provider
          ? `No match (${provider}${code != null ? `, ACR ${code}` : ''}). Point the mic at the PA and record at least 8 seconds of music.`
          : code != null
            ? `No match (ACR ${code}). Record at least 8 seconds of clear music from the speakers.`
            : null,
      };
    }

    const artist = (data.match.artist ?? '').trim();
    const title = (data.match.title ?? '').trim();
    const message =
      title && artist
        ? `Identified: ${title} — ${artist}`
        : title
          ? `Identified: ${title}`
          : artist
            ? `Identified: ${artist}`
            : null;
    const confidence =
      typeof data.match.confidence === 'number' && Number.isFinite(data.match.confidence)
        ? data.match.confidence
        : undefined;
    return { status: 'match', artist, title, message, confidence };
  } catch (e) {
    console.error('Song identify', e);
    return { status: 'error', message: 'Song lookup failed' };
  }
}
