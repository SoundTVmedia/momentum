/** Normalize a search query or entity name for intent matching. */
export function normalizeSearchName(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the query is naming this entity, not merely sharing a substring.
 * "Madison Square Garden" matches that venue; "Garden" or "Phish" does not.
 */
export function searchQueryTargetsName(query: string, name: string): boolean {
  const q = normalizeSearchName(query);
  const n = normalizeSearchName(name);
  if (!q || !n || q.length < 3) return false;
  if (q === n) return true;

  const qTokens = q.split(' ');
  const nTokens = n.split(' ');

  if (qTokens.length === 1) {
    return nTokens.length === 1 && qTokens[0] === nTokens[0];
  }

  if (qTokens.every((token) => nTokens.includes(token))) return true;
  // Query is a word-bounded prefix of the name ("madison square" → "madison square garden").
  if (n.startsWith(`${q} `) && q.length >= 8) return true;

  return false;
}

export function jamBaseSearchRecordName(row: Record<string, unknown>): string {
  return typeof row.name === 'string' ? row.name : '';
}

export function discoverSearchIsVenueIntent(
  query: string,
  names: {
    venues?: Array<string | null | undefined>;
    artists?: Array<string | null | undefined>;
    songs?: Array<string | null | undefined>;
  },
): boolean {
  const venueHit = (names.venues ?? []).some(
    (name) => typeof name === 'string' && searchQueryTargetsName(query, name),
  );
  if (!venueHit) return false;
  const artistHit = (names.artists ?? []).some(
    (name) => typeof name === 'string' && searchQueryTargetsName(query, name),
  );
  const songHit = (names.songs ?? []).some(
    (name) => typeof name === 'string' && searchQueryTargetsName(query, name),
  );
  return !artistHit && !songHit;
}

export function discoverResultsAreVenueIntent(
  query: string,
  results: {
    venues?: Array<{ name?: string | null }>;
    artists?: Array<{ name?: string | null }>;
    songs?: Array<{ title?: string | null }>;
    jambase?: { venues?: Array<Record<string, unknown>> };
  },
): boolean {
  return discoverSearchIsVenueIntent(query, {
    venues: [
      ...(results.venues ?? []).map((row) => row.name),
      ...(results.jambase?.venues ?? []).map(jamBaseSearchRecordName),
    ],
    artists: (results.artists ?? []).map((row) => row.name),
    songs: (results.songs ?? []).map((row) => row.title),
  });
}
