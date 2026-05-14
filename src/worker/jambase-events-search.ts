import {
  jamBaseFetch,
  jamBaseEventDateFromToday,
  type JamBaseQuotaContext,
} from './jambase-client';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
} from '../shared/jambase-slug';

function eventMatchesQuery(ev: Record<string, unknown>, qLower: string): boolean {
  const name = typeof ev.name === 'string' ? ev.name.toLowerCase() : '';
  if (name.includes(qLower)) return true;
  const venue = ev.location as Record<string, unknown> | undefined;
  const vn = typeof venue?.name === 'string' ? venue.name.toLowerCase() : '';
  if (vn.includes(qLower)) return true;
  const perf = ev.performer;
  if (Array.isArray(perf)) {
    for (const p of perf) {
      if (typeof p === 'object' && p !== null) {
        const nm = (p as Record<string, unknown>).name;
        if (typeof nm === 'string' && nm.toLowerCase().includes(qLower)) return true;
      }
    }
  }
  return false;
}

export function dedupeJamBaseEvents(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const ev of events) {
    const id = typeof ev.identifier === 'string' ? ev.identifier : JSON.stringify(ev);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(ev);
  }
  return out;
}

/** Same JamBase `artistName` / `venueName` input used by tight event search (slug-aware). */
export function jamBaseArtistVenueSearchPhrase(rawQuery: string): string {
  const q = rawQuery.trim();
  if (q.length < 2) return q;
  const slug = slugifyEntityName(q) || normalizedSlugFromRouteParam(q);
  const phrase = searchPhraseFromSlug(slug)?.trim();
  return phrase && phrase.length > 0 ? phrase : q;
}

export type JamBasePreloadedArtistVenueLists = {
  artistList: { artists?: Record<string, unknown>[] } | null;
  venueList: { venues?: Record<string, unknown>[] } | null;
};

/**
 * Stricter event discovery: resolve top artist + venue matches, fetch their calendars,
 * dedupe, then keep events that match the query text (name, venue, or performer).
 *
 * Pass `preloaded` when you already fetched `/artists` + `/venues` for the same phrase
 * (e.g. Discover advanced search) to avoid duplicate upstream calls and quota spikes.
 */
export async function buildTightJamBaseEventResults(
  apiKey: string,
  query: string,
  maxResults = 18,
  quota?: JamBaseQuotaContext,
  preloaded?: JamBasePreloadedArtistVenueLists | null
): Promise<unknown[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  const phrase = jamBaseArtistVenueSearchPhrase(q);
  const fromDate = jamBaseEventDateFromToday();

  let artistList: { artists?: Record<string, unknown>[] } | null;
  let venueList: { venues?: Record<string, unknown>[] } | null;
  if (preloaded) {
    artistList = preloaded.artistList;
    venueList = preloaded.venueList;
  } else {
    [artistList, venueList] = await Promise.all([
      jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
        apiKey,
        '/artists',
        {
          artistName: phrase,
          perPage: '8',
          page: '1',
        },
        quota
      ),
      jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
        apiKey,
        '/venues',
        {
          venueName: phrase,
          perPage: '6',
          page: '1',
        },
        quota
      ),
    ]);
  }

  const topArtists = (artistList?.artists ?? []).slice(0, 4);
  const topVenues = (venueList?.venues ?? []).slice(0, 3);

  const artistEventCalls = topArtists
    .filter((a) => typeof a.identifier === 'string')
    .map((a) =>
      jamBaseFetch<{ events?: Record<string, unknown>[] }>(
        apiKey,
        '/events',
        {
          artistId: String(a.identifier),
          eventDateFrom: fromDate,
          perPage: '10',
          page: '1',
        },
        quota
      )
    );

  const venueEventCalls = topVenues
    .filter((v) => typeof v.identifier === 'string')
    .map((v) =>
      jamBaseFetch<{ events?: Record<string, unknown>[] }>(
        apiKey,
        '/events',
        {
          venueId: String(v.identifier),
          eventDateFrom: fromDate,
          perPage: '10',
          page: '1',
        },
        quota
      )
    );

  const batchResults = await Promise.all([...artistEventCalls, ...venueEventCalls]);
  let merged: Record<string, unknown>[] = [];
  for (const res of batchResults) {
    merged.push(...(res?.events ?? []));
  }

  merged = dedupeJamBaseEvents(merged);
  merged = merged.filter((ev) => eventMatchesQuery(ev, qLower));

  merged.sort((a, b) => {
    const da = typeof a.startDate === 'string' ? a.startDate : '';
    const db = typeof b.startDate === 'string' ? b.startDate : '';
    return da.localeCompare(db);
  });

  if (merged.length < Math.min(6, maxResults)) {
    const fallback = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      apiKey,
      '/events',
      {
        artistName: phrase,
        eventDateFrom: fromDate,
        perPage: '24',
        page: '1',
      },
      quota
    );
    const fe = fallback?.events ?? [];
    for (const ev of fe) {
      if (eventMatchesQuery(ev, qLower)) merged.push(ev);
    }
    merged = dedupeJamBaseEvents(merged);
    merged.sort((a, b) => {
      const da = typeof a.startDate === 'string' ? a.startDate : '';
      const db = typeof b.startDate === 'string' ? b.startDate : '';
      return da.localeCompare(db);
    });
  }

  return merged.slice(0, maxResults);
}
