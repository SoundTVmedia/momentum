import { genreHashtagToken, isGenreHashtagToken } from './genre-tag';
import { songHashtagToken, isSongHashtagToken } from './song-tag';

/** Stable single token from a display string for `clips.hashtags` (no `#` prefix). */
export function nameToHashtagToken(name: string): string {
  return name
    .trim()
    .replace(/^#+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim();
}

/**
 * Parse `#` tags from the form and ensure artist + `song:<slug>` + `genre:<slug>` tokens.
 */
export function buildHashtagsArrayForPost(
  hashtagInput: string,
  artistName: string,
  songTitle: string,
  genreName: string = '',
): string[] {
  const fromInput = hashtagInput
    .split(/\s+/)
    .filter((tag) => tag.startsWith('#'))
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
    .filter((t) => !isSongHashtagToken(t) && !isGenreHashtagToken(t));

  const seen = new Set(fromInput.map((t) => t.toLowerCase()));
  const out = [...fromInput];

  const artistToken = nameToHashtagToken(artistName);
  if (artistToken.length > 0 && !seen.has(artistToken.toLowerCase())) {
    out.push(artistToken);
    seen.add(artistToken.toLowerCase());
  }

  const songToken = songHashtagToken(songTitle);
  if (songToken && !seen.has(songToken.toLowerCase())) {
    out.push(songToken);
    seen.add(songToken.toLowerCase());
  }

  const genreToken = genreHashtagToken(genreName);
  if (genreToken && !seen.has(genreToken.toLowerCase())) {
    out.push(genreToken);
    seen.add(genreToken.toLowerCase());
  }

  return out;
}
