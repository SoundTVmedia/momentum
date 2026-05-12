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
  | { status: 'match'; artist: string; title: string; message: string | null }
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
 * Short in-browser snippet → worker `/api/clips/identify-music` → AudD.
 * Call after capture (before navigating to the caption screen) so fields can be prefilled for review.
 */
export async function identifyMusicWithAudD(source: Blob): Promise<AudDIdentifyResult> {
  const snippet = await extractMediaSnippetForAudD(source);
  if (!snippet || snippet.size < 400) {
    return {
      status: 'skipped',
      message:
        'Could not capture enough audio from this clip for song ID (needs clearer music in the recording, or try again).',
    };
  }

  try {
    const fd = new FormData();
    fd.set('file', snippet, 'clip-snippet.webm');
    const res = await fetch('/api/clips/identify-music', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const data = (await res.json()) as {
      ok?: boolean;
      skipped?: boolean;
      match?: { artist?: string; title?: string } | null;
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
    return { status: 'match', artist, title, message };
  } catch (e) {
    console.error('AudD identify', e);
    return { status: 'error', message: 'Song lookup failed' };
  }
}
