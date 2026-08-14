/**
 * Post-match filter for ShazamKit / ACRCloud.
 * Neither catalog API can constrain a fingerprint search to one artist, so we
 * drop (or skip) results whose credited artist does not match the show/clip.
 */

const FEAT_SPLIT = /\s+(?:feat\.?|ft\.?|featuring|with)\s+/i;

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Lowercase, no punctuation, "and" for "&", no leading "the". */
export function normalizeArtistName(value: string | null | undefined): string {
  if (!value) return '';
  let s = stripDiacritics(String(value).toLowerCase().trim());
  s = s.replace(/&/g, ' and ');
  s = s.replace(/['’]/g, '');
  s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^the\s+/, '');
  return s;
}

/** Primary billing name before feat./ft./with. */
export function primaryArtistName(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).split(FEAT_SPLIT)[0]?.trim() ?? '';
}

export function splitExpectedArtists(expected: string | null | undefined): string[] {
  if (!expected?.trim()) return [];
  // Require spaces around / and | so "AC/DC" stays one name.
  return String(expected)
    .split(/\s+\/\s+|\s+\|\s+|;\s*|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * True when `recognized` is the same act as `expected` (or a billed feature
 * of that act). "Paul Wall" matches "Paul Wall feat. Chamillionaire".
 * Empty expected never filters (library uploads / missing show data).
 */
export function artistNamesMatch(
  expected: string | null | undefined,
  recognized: string | null | undefined,
): boolean {
  const expectedNorm = normalizeArtistName(primaryArtistName(expected));
  if (!expectedNorm) return true;
  const recognizedFull = normalizeArtistName(recognized);
  if (!recognizedFull) return false;
  const recognizedPrimary = normalizeArtistName(primaryArtistName(recognized));

  const candidates = [recognizedFull, recognizedPrimary].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === expectedNorm) return true;
    if (candidate.startsWith(`${expectedNorm} `) || expectedNorm.startsWith(`${candidate} `)) {
      return true;
    }
    const expectedTokens = expectedNorm.split(' ').filter(Boolean);
    const candidateTokens = candidate.split(' ').filter(Boolean);
    if (
      expectedTokens.length >= 2 &&
      expectedTokens.every((token) => candidateTokens.includes(token))
    ) {
      return true;
    }
  }
  return false;
}

/** True when any billed show artist matches the recognized credit. */
export function recognizedArtistMatchesShow(
  expectedArtist: string | null | undefined,
  recognizedArtist: string | null | undefined,
): boolean {
  const parts = splitExpectedArtists(expectedArtist);
  if (parts.length === 0) return true;
  return parts.some((part) => artistNamesMatch(part, recognizedArtist));
}
