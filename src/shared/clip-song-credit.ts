import { recognizedArtistMatchesShow } from './song-artist-match';

/** Normalize a song title for “is this the same song?” checks. */
export function normalizeSongTitle(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function songTitlesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeSongTitle(a);
  const right = normalizeSongTitle(b);
  if (!left || !right) return false;
  return left === right;
}

export function isSongTitleForced(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

/**
 * True when the fingerprint hit is a different act than the JamBase headliner.
 * Shown as an “Opener” badge — not a failed identify.
 */
export function clipShowsOpenerBadge(clip: {
  artist_name?: string | null;
  recognized_song_artist?: string | null;
}): boolean {
  const headliner = clip.artist_name?.trim() ?? '';
  const recognized = clip.recognized_song_artist?.trim() ?? '';
  if (!headliner || !recognized) return false;
  return !recognizedArtistMatchesShow(headliner, recognized);
}

export type SongCreditPersistFields = {
  recognized_song_title: string | null;
  recognized_song_artist: string | null;
  song_title_forced: number;
};

export function songCreditFromIdentifyMatch(match: {
  title?: string | null;
  artist?: string | null;
}): SongCreditPersistFields {
  const title = match.title?.trim() || null;
  const artist = match.artist?.trim() || null;
  return {
    recognized_song_title: title,
    recognized_song_artist: artist,
    song_title_forced: 0,
  };
}
