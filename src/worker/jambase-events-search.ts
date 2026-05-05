import { jamBaseFetch, jamBaseEventDateFromToday } from './jambase-client';
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

function dedupeEvents(events: Record<string, unknown>[]): Record<string, unknown>[] {
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

/**
 * Stricter event discovery: resolve top artist + venue matches, fetch their calendars,
 * dedupe, then keep events that match the query text (name, venue, or performer).
 */
export async function buildTightJamBaseEventResults(
  apiKey: string,
  query: string,
  maxResults = 18
): Promise<unknown[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  const slug = slugifyEntityName(q) || normalizedSlugFromRouteParam(q);
  const phrase = searchPhraseFromSlug(slug);
  const fromDate = jamBaseEventDateFromToday();

  const [artistList, venueList] = await Promise.all([
    jamBaseFetch<{ artists?: Record<string, unknown>[] }>(apiKey, '/artists', {
      artistName: phrase,
      perPage: '8',
      page: '1',
    }),
    jamBaseFetch<{ venues?: Record<string, unknown>[] }>(apiKey, '/venues', {
      venueName: phrase,
      perPage: '6',
      page: '1',
    }),
  ]);

  const topArtists = (artistList?.artists ?? []).slice(0, 4);
  const topVenues = (venueList?.venues ?? []).slice(0, 3);

  const artistEventCalls = topArtists
    .filter((a) => typeof a.identifier === 'string')
    .map((a) =>
      jamBaseFetch<{ events?: Record<string, unknown>[] }>(apiKey, '/events', {
        artistId: String(a.identifier),
        eventDateFrom: fromDate,
        perPage: '10',
        page: '1',
      })
    );

  const venueEventCalls = topVenues
    .filter((v) => typeof v.identifier === 'string')
    .map((v) =>
      jamBaseFetch<{ events?: Record<string, unknown>[] }>(apiKey, '/events', {
        venueId: String(v.identifier),
        eventDateFrom: fromDate,
        perPage: '10',
        page: '1',
      })
    );

  const batchResults = await Promise.all([...artistEventCalls, ...venueEventCalls]);
  let merged: Record<string, unknown>[] = [];
  for (const res of batchResults) {
    merged.push(...(res?.events ?? []));
  }

  merged = dedupeEvents(merged);
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
      }
    );
    const fe = fallback?.events ?? [];
    for (const ev of fe) {
      if (eventMatchesQuery(ev, qLower)) merged.push(ev);
    }
    merged = dedupeEvents(merged);
    merged.sort((a, b) => {
      const da = typeof a.startDate === 'string' ? a.startDate : '';
      const db = typeof b.startDate === 'string' ? b.startDate : '';
      return da.localeCompare(db);
    });
  }

  return merged.slice(0, maxResults);
}
