/**
 * URL slugs for artist and venue pages (e.g. "Taylor Swift" → "taylor-swift").
 */

export function slugifyEntityName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Normalize route param from /artists/:artistName or /venues/:venueName */
export function normalizedSlugFromRouteParam(param: string): string {
  try {
    const decoded = decodeURIComponent(param).trim().toLowerCase();
    return decoded
      .replace(/\+/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  } catch {
    return param.trim().toLowerCase().replace(/\s+/g, '-');
  }
}

export function searchPhraseFromSlug(normalizedSlug: string): string {
  return normalizedSlug.replace(/-/g, ' ').trim();
}

export function titleCaseWords(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
