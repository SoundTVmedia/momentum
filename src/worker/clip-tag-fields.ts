import { buildHashtagsArrayForPost } from '../shared/clip-hashtags';
import { genreSlugFromName } from '../shared/genre-tag';
import { songSlugFromTitle } from '../shared/song-tag';

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function forcedFlag(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

export function songFieldsFromBody(body: Record<string, unknown>): {
  song_title: string | null;
  song_slug: string | null;
} {
  const song_title = trimOrNull(body.song_title ?? body.songTitle);
  const song_slug = song_title ? songSlugFromTitle(song_title) || null : null;
  return { song_title, song_slug };
}

export function songCreditFieldsFromBody(body: Record<string, unknown>): {
  recognized_song_title: string | null;
  recognized_song_artist: string | null;
  song_title_forced: number;
} {
  const recognized_song_title = trimOrNull(
    body.recognized_song_title ?? body.recognizedSongTitle,
  );
  const recognized_song_artist = trimOrNull(
    body.recognized_song_artist ?? body.recognizedSongArtist,
  );
  const song_title_forced = forcedFlag(body.song_title_forced ?? body.songTitleForced);
  return { recognized_song_title, recognized_song_artist, song_title_forced };
}

/** Keep existing fingerprint credits unless this save explicitly sent them. */
export function songCreditForClipUpdate(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
): {
  recognized_song_title: string | null;
  recognized_song_artist: string | null;
  song_title_forced: number;
} {
  const touched =
    'recognized_song_title' in body ||
    'recognizedSongTitle' in body ||
    'recognized_song_artist' in body ||
    'recognizedSongArtist' in body ||
    'song_title_forced' in body ||
    'songTitleForced' in body;
  if (!touched) {
    return {
      recognized_song_title: trimOrNull(existing.recognized_song_title),
      recognized_song_artist: trimOrNull(existing.recognized_song_artist),
      song_title_forced: forcedFlag(existing.song_title_forced),
    };
  }
  return songCreditFieldsFromBody(body);
}

export function genreFieldsFromBody(body: Record<string, unknown>): {
  genre_name: string | null;
  genre_slug: string | null;
} {
  const genre_name = trimOrNull(body.genre_name ?? body.genreName);
  const genre_slug = genre_name ? genreSlugFromName(genre_name) || null : null;
  return { genre_name, genre_slug };
}

export function buildHashtagsForClipBody(body: Record<string, unknown>): string[] {
  const artist = trimOrNull(body.artist_name) ?? '';
  const { song_title } = songFieldsFromBody(body);
  const { genre_name } = genreFieldsFromBody(body);
  const raw = body.hashtags;
  let input = '';
  if (typeof raw === 'string') input = raw;
  else if (Array.isArray(raw)) {
    input = raw.map((t) => `#${String(t).replace(/^#+/, '')}`).join(' ');
  }
  return buildHashtagsArrayForPost(input, artist, song_title ?? '', genre_name ?? '');
}
