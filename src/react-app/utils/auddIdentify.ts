import { extractMediaSnippetForAudD } from '@/react-app/utils/extractMediaSnippetForAudD';

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
  | { status: 'nomatch' }
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
const MIN_SNIPPET_BYTES = 220;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function identifyMusicWithAudD(source: Blob): Promise<AudDIdentifyResult> {
  let snippet: Blob | null = null;

  if (source.type.startsWith('audio/') && source.size >= MIN_SNIPPET_BYTES) {
    snippet = source.size <= MAX_UPLOAD_BYTES ? source : source.slice(0, MAX_UPLOAD_BYTES);
  } else {
    snippet = await extractMediaSnippetForAudD(source);
  }

  if (!snippet || snippet.size < MIN_SNIPPET_BYTES) {
    return {
      status: 'skipped',
      message:
        'Could not capture enough audio from this clip for song ID (needs clearer music in the recording, or try again).',
    };
  }

  try {
    const fd = new FormData();
    const fileName =
      snippet.type.includes('mp4') || snippet.type.includes('aac') || snippet.type.includes('mpeg')
        ? 'clip-snippet.m4a'
        : 'clip-snippet.webm';
    fd.set('file', snippet, fileName);
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
    };

    if (data.skipped) {
      const fromApi = typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : null;
      return { status: 'skipped', message: fromApi };
    }
    if (!res.ok || data.ok === false) {
      return {
        status: 'error',
        message: typeof data.error === 'string' ? data.error : 'Song lookup failed',
      };
    }
    if (!data.match || (!data.match.artist && !data.match.title)) {
      return { status: 'nomatch' };
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
    console.error('AudD identify', e);
    return { status: 'error', message: 'Song lookup failed' };
  }
}
