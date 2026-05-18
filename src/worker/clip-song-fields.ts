import { songSlugFromTitle } from '../shared/song-tag';
import { buildHashtagsArrayForPost } from '../shared/clip-hashtags';

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function songFieldsFromBody(body: Record<string, unknown>): {
  song_title: string | null;
  song_slug: string | null;
} {
  const song_title = trimOrNull(body.song_title ?? body.songTitle);
  const song_slug = song_title ? songSlugFromTitle(song_title) || null : null;
  return { song_title, song_slug };
}

export function buildHashtagsForClipBody(body: Record<string, unknown>): string[] {
  const artist = trimOrNull(body.artist_name) ?? '';
  const { song_title } = songFieldsFromBody(body);
  const raw = body.hashtags;
  let input = '';
  if (typeof raw === 'string') input = raw;
  else if (Array.isArray(raw)) {
    input = raw.map((t) => `#${String(t).replace(/^#+/, '')}`).join(' ');
  }
  return buildHashtagsArrayForPost(input, artist, song_title ?? '');
}
