import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
  titleCaseWords,
} from './jambase-slug';

/** Hashtag token prefix for genre identity (e.g. `genre:rock`). */
export const GENRE_HASHTAG_PREFIX = 'genre:';

export function genreSlugFromName(name: string | null | undefined): string {
  return slugifyEntityName(name);
}

export function genreHashtagToken(name: string | null | undefined): string | null {
  const slug = genreSlugFromName(name);
  return slug ? `${GENRE_HASHTAG_PREFIX}${slug}` : null;
}

export function isGenreHashtagToken(token: string): boolean {
  return token.trim().toLowerCase().startsWith(GENRE_HASHTAG_PREFIX);
}

export function genreSlugFromHashtagToken(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (!t.startsWith(GENRE_HASHTAG_PREFIX)) return null;
  const slug = t.slice(GENRE_HASHTAG_PREFIX.length).replace(/^:+/, '').trim();
  return slug || null;
}

export function genreNameFromSlug(slug: string): string {
  const normalized = normalizedSlugFromRouteParam(slug);
  return titleCaseWords(searchPhraseFromSlug(normalized)) || normalized;
}

export function genreHashtagLikePattern(slug: string): string {
  return `%"${GENRE_HASHTAG_PREFIX}${slug}"%`;
}
