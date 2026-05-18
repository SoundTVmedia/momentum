import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
  titleCaseWords,
} from './jambase-slug';

/** Hashtag token prefix for song identity (e.g. `song:wonderwall`). */
export const SONG_HASHTAG_PREFIX = 'song:';

export function songSlugFromTitle(title: string | null | undefined): string {
  return slugifyEntityName(title);
}

export function songHashtagToken(title: string | null | undefined): string | null {
  const slug = songSlugFromTitle(title);
  return slug ? `${SONG_HASHTAG_PREFIX}${slug}` : null;
}

export function isSongHashtagToken(token: string): boolean {
  return token.trim().toLowerCase().startsWith(SONG_HASHTAG_PREFIX);
}

export function songSlugFromHashtagToken(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (!t.startsWith(SONG_HASHTAG_PREFIX)) return null;
  const slug = t.slice(SONG_HASHTAG_PREFIX.length).replace(/^:+/, '').trim();
  return slug || null;
}

export function songTitleFromSlug(slug: string): string {
  const normalized = normalizedSlugFromRouteParam(slug);
  return titleCaseWords(searchPhraseFromSlug(normalized)) || normalized;
}

export function songHashtagLikePattern(slug: string): string {
  return `%"${SONG_HASHTAG_PREFIX}${slug}"%`;
}
