import {
  jamBaseFetch,
  jamBaseEventDateFromDaysAgo,
  jamBaseEventDateFromToday,
  type JamBaseQuotaContext,
} from './jambase-client';
import { jamBaseEventUpcomingOrInProgress } from '../shared/jambase-event-day';
import { isJamBaseFestivalEvent } from '../shared/jambase-festival';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
} from '../shared/jambase-slug';
import { libraryEventsForFindAShow } from './library-show-search';

/** Recent archive window so first-page results are not decades-old tours. */
export const JAMBASE_RECENT_PAST_LOOKBACK_DAYS = 120;
/**
 * Broader Find a Show archive window. JamBase geo `/events` cannot use
 * `eventDateFrom` before UTC today; artistId/venueId calendars with
 * `expandPastEvents` return about two years of history.
 */
export const JAMBASE_ARCHIVE_LOOKBACK_DAYS = 730;
/** Share of Find a Show slots reserved for past shows when both exist. */
export const FIND_A_SHOW_PAST_SHARE = 0.75;

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

export function jamBaseEventIdentifier(ev: Record<string, unknown>): string {
  const raw = ev.identifier;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return `jambase:${raw}`;
  return '';
}

export function dedupeJamBaseEvents(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const ev of events) {
    const id = jamBaseEventIdentifier(ev) || JSON.stringify(ev);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(ev);
  }
  return out;
}

/** JamBase `/events?name=` — title search for festivals and billed show names (not artistName). */
export async function fetchJamBaseEventsByEventName(
  apiKey: string,
  name: string,
  quota?: JamBaseQuotaContext,
  opts?: {
    eventType?: 'festival' | 'concert';
    perPage?: string;
    page?: string;
    eventDateFrom?: string;
    eventDateTo?: string;
    expandPastEvents?: string;
  },
): Promise<Record<string, unknown>[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const params: Record<string, string> = {
    name: trimmed,
    perPage: opts?.perPage ?? '24',
    page: opts?.page ?? '1',
    eventDateFrom: opts?.eventDateFrom || jamBaseEventDateFromToday(),
  };
  if (opts?.eventDateTo) params.eventDateTo = opts.eventDateTo;
  if (opts?.eventType) params.eventType = opts.eventType;
  if (opts?.expandPastEvents) params.expandPastEvents = opts.expandPastEvents;
  const data = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
    apiKey,
    '/events',
    params,
    quota,
  );
  return data?.events ?? [];
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

function eventStartKey(ev: Record<string, unknown>): string {
  return typeof ev.startDate === 'string' ? ev.startDate : '';
}

function splitUpcomingAndPast(
  events: Record<string, unknown>[],
  nowMs: number,
): { upcoming: Record<string, unknown>[]; past: Record<string, unknown>[] } {
  const upcoming: Record<string, unknown>[] = [];
  const past: Record<string, unknown>[] = [];
  for (const ev of events) {
    if (jamBaseEventUpcomingOrInProgress(ev, nowMs)) upcoming.push(ev);
    else past.push(ev);
  }
  upcoming.sort((a, b) => eventStartKey(a).localeCompare(eventStartKey(b)));
  past.sort((a, b) => eventStartKey(b).localeCompare(eventStartKey(a)));
  return { upcoming, past };
}

/**
 * Find a Show mix: past first, and more past than upcoming when both exist
 * (about 75% past / 25% upcoming), filling leftover slots from the other bucket.
 */
export function mixFindAShowEvents(
  events: Record<string, unknown>[],
  max: number,
  nowMs: number = Date.now(),
): Record<string, unknown>[] {
  const limit = Math.max(0, max);
  if (limit === 0) return [];
  const { upcoming, past } = splitUpcomingAndPast(events, nowMs);
  if (past.length === 0 || upcoming.length === 0) {
    const pastTake = Math.min(past.length, limit);
    const upcomingTake = Math.min(upcoming.length, limit - pastTake);
    return [...past.slice(0, pastTake), ...upcoming.slice(0, upcomingTake)];
  }
  const preferredUpcoming = Math.max(1, Math.floor(limit * (1 - FIND_A_SHOW_PAST_SHARE)));
  let upcomingTake = Math.min(upcoming.length, preferredUpcoming, limit);
  let pastTake = Math.min(past.length, limit - upcomingTake);
  const leftover = limit - pastTake - upcomingTake;
  upcomingTake = Math.min(upcoming.length, upcomingTake + leftover);
  return [...past.slice(0, pastTake), ...upcoming.slice(0, upcomingTake)];
}

/**
 * Find a Show results: JamBase archive first, then library-only nights, then upcoming.
 * Library shows no longer crowd out the event archive.
 */
export function mixFindAShowArchiveFirst(
  jambasePast: Record<string, unknown>[],
  library: Record<string, unknown>[],
  upcoming: Record<string, unknown>[],
  max: number,
  nowMs: number = Date.now(),
): Record<string, unknown>[] {
  const limit = Math.max(0, max);
  if (limit === 0) return [];

  const seen = new Set<string>();
  const take = (list: Record<string, unknown>[], n: number): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = [];
    for (const ev of list) {
      if (out.length >= n) break;
      const id = jamBaseEventIdentifier(ev) || JSON.stringify(ev);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(ev);
    }
    return out;
  };

  const pastJam = jambasePast
    .filter((ev) => !jamBaseEventUpcomingOrInProgress(ev, nowMs))
    .sort((a, b) => eventStartKey(b).localeCompare(eventStartKey(a)));
  const libPast = library
    .filter((ev) => !jamBaseEventUpcomingOrInProgress(ev, nowMs))
    .sort((a, b) => eventStartKey(b).localeCompare(eventStartKey(a)));
  const up = upcoming
    .filter((ev) => jamBaseEventUpcomingOrInProgress(ev, nowMs))
    .sort((a, b) => eventStartKey(a).localeCompare(eventStartKey(b)));

  const upcomingTake =
    up.length === 0 || (pastJam.length === 0 && libPast.length === 0)
      ? Math.min(up.length, limit)
      : Math.min(up.length, Math.max(1, Math.floor(limit * (1 - FIND_A_SHOW_PAST_SHARE))), limit);
  const pastSlots = limit - upcomingTake;
  const jamTake = take(pastJam, pastSlots);
  const libTake = take(libPast, pastSlots - jamTake.length);
  const upTake = take(up, limit - jamTake.length - libTake.length);
  return [...jamTake, ...libTake, ...upTake];
}

/**
 * Past JamBase concerts. Geo `/events` cannot look back before today; artistId /
 * venueId calendars can when `expandPastEvents=true`.
 */
export async function buildPastJamBaseEventResults(
  apiKey: string,
  query: string,
  maxResults = 18,
  quota?: JamBaseQuotaContext,
  opts?: { page?: number },
): Promise<Record<string, unknown>[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  const phrase = jamBaseArtistVenueSearchPhrase(q);
  const slug = slugifyEntityName(phrase) || normalizedSlugFromRouteParam(phrase);
  const archiveFrom = jamBaseEventDateFromDaysAgo(JAMBASE_ARCHIVE_LOOKBACK_DAYS);
  const page = String(Math.max(1, opts?.page ?? 1));
  const perPage = String(Math.min(40, Math.max(maxResults, 16)));

  const [artistList, venueList] = await Promise.all([
    jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
      apiKey,
      '/artists',
      { artistName: phrase, perPage: '8', page: '1' },
      quota,
    ),
    jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
      apiKey,
      '/venues',
      { venueName: phrase, perPage: '6', page: '1' },
      quota,
    ),
  ]);

  const artists = artistList?.artists ?? [];
  const exactArtist = artists.find((a) => slugifyEntityName(String(a.name ?? '')) === slug);
  const topArtists = (exactArtist ? [exactArtist, ...artists] : artists)
    .filter((a, i, list) => list.findIndex((x) => x.identifier === a.identifier) === i)
    .slice(0, 4);
  const topVenues = (venueList?.venues ?? []).slice(0, 3);

  const calendarParams = {
    eventDateFrom: archiveFrom,
    expandPastEvents: 'true',
    perPage,
    page,
  };

  const [artistCalendars, venueCalendars, byTitle] = await Promise.all([
    Promise.all(
      topArtists
        .filter((a) => typeof a.identifier === 'string')
        .map((a) =>
          jamBaseFetch<{ events?: Record<string, unknown>[] }>(
            apiKey,
            '/events',
            { artistId: String(a.identifier), ...calendarParams },
            quota,
          ),
        ),
    ),
    Promise.all(
      topVenues
        .filter((v) => typeof v.identifier === 'string')
        .map((v) =>
          jamBaseFetch<{ events?: Record<string, unknown>[] }>(
            apiKey,
            '/events',
            { venueId: String(v.identifier), ...calendarParams },
            quota,
          ),
        ),
    ),
    fetchJamBaseEventsByEventName(apiKey, phrase, quota, {
      perPage,
      page,
      eventDateFrom: archiveFrom,
      expandPastEvents: 'true',
    }),
  ]);

  const nowMs = Date.now();
  const merged = dedupeJamBaseEvents([
    ...artistCalendars.flatMap((row) => row?.events ?? []),
    ...venueCalendars.flatMap((row) => row?.events ?? []),
    ...byTitle,
  ]).filter((ev) => eventMatchesQuery(ev, qLower) && !jamBaseEventUpcomingOrInProgress(ev, nowMs));
  merged.sort((a, b) => eventStartKey(b).localeCompare(eventStartKey(a)));
  return merged.slice(0, maxResults);
}

/** Recent concluded concerts from JamBase when the archive browse has no search query. */
async function archiveBrowseEntityIds(
  db: D1Database,
): Promise<{ artistIds: string[]; venueIds: string[] }> {
  const collect = async (sql: string): Promise<string[]> => {
    try {
      const rows = await db.prepare(sql).all<{ id: string }>();
      return (rows.results ?? [])
        .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const [libraryArtists, cachedArtists, libraryVenues, cachedVenues] = await Promise.all([
    collect(`
      SELECT jambase_artist_id AS id
      FROM library_shows
      WHERE jambase_artist_id IS NOT NULL AND TRIM(jambase_artist_id) != ''
      GROUP BY jambase_artist_id
      ORDER BY MAX(start_date) DESC
      LIMIT 8
    `),
    collect(`
      SELECT artist_jambase_id AS id
      FROM jambase_events
      WHERE artist_jambase_id IS NOT NULL AND TRIM(artist_jambase_id) != ''
      GROUP BY artist_jambase_id
      ORDER BY MAX(start_date) DESC
      LIMIT 8
    `),
    collect(`
      SELECT jambase_venue_id AS id
      FROM library_shows
      WHERE jambase_venue_id IS NOT NULL AND TRIM(jambase_venue_id) != ''
      GROUP BY jambase_venue_id
      ORDER BY MAX(start_date) DESC
      LIMIT 4
    `),
    collect(`
      SELECT venue_jambase_id AS id
      FROM jambase_events
      WHERE venue_jambase_id IS NOT NULL AND TRIM(venue_jambase_id) != ''
      GROUP BY venue_jambase_id
      ORDER BY MAX(start_date) DESC
      LIMIT 4
    `),
  ]);

  const unique = (ids: string[], max: number): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= max) break;
    }
    return out;
  };

  return {
    artistIds: unique([...libraryArtists, ...cachedArtists], 8),
    venueIds: unique([...libraryVenues, ...cachedVenues], 4),
  };
}

export async function browseRecentPastJamBaseEvents(
  apiKey: string,
  maxResults = 24,
  quota?: JamBaseQuotaContext,
  opts?: { page?: number; db?: D1Database },
): Promise<Record<string, unknown>[]> {
  const page = String(Math.max(1, opts?.page ?? 1));
  const perPage = String(Math.min(40, Math.max(maxResults, 16)));
  const calendarParams = {
    eventDateFrom: jamBaseEventDateFromDaysAgo(JAMBASE_RECENT_PAST_LOOKBACK_DAYS),
    expandPastEvents: 'true',
    perPage,
    page,
  };
  const ids = opts?.db
    ? await archiveBrowseEntityIds(opts.db)
    : { artistIds: [] as string[], venueIds: [] as string[] };

  const [artistCalendars, venueCalendars] = await Promise.all([
    Promise.all(
      ids.artistIds.map((artistId) =>
        jamBaseFetch<{ events?: Record<string, unknown>[] }>(
          apiKey,
          '/events',
          { artistId, ...calendarParams },
          quota,
        ),
      ),
    ),
    Promise.all(
      ids.venueIds.map((venueId) =>
        jamBaseFetch<{ events?: Record<string, unknown>[] }>(
          apiKey,
          '/events',
          { venueId, ...calendarParams },
          quota,
        ),
      ),
    ),
  ]);

  const nowMs = Date.now();
  const events = dedupeJamBaseEvents([
    ...artistCalendars.flatMap((row) => row?.events ?? []),
    ...venueCalendars.flatMap((row) => row?.events ?? []),
  ]).filter((ev) => ev && typeof ev === 'object' && !jamBaseEventUpcomingOrInProgress(ev, nowMs));
  events.sort((a, b) => eventStartKey(b).localeCompare(eventStartKey(a)));
  return events.slice(0, maxResults);
}

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
  preloaded?: JamBasePreloadedArtistVenueLists | null,
  eventDateFrom?: string,
): Promise<unknown[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  const phrase = jamBaseArtistVenueSearchPhrase(q);
  const fromDate = eventDateFrom || jamBaseEventDateFromToday();

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

  const titlePerPage = String(Math.min(24, Math.max(maxResults, 8)));
  const wantFestivalTitle =
    isJamBaseFestivalEvent({ name: q }) || isJamBaseFestivalEvent({ name: phrase });
  const [batchResults, titledEvents, festivalEvents] = await Promise.all([
    Promise.all([...artistEventCalls, ...venueEventCalls]),
    fetchJamBaseEventsByEventName(apiKey, phrase, quota, {
      perPage: titlePerPage,
      eventDateFrom: fromDate,
    }),
    wantFestivalTitle
      ? fetchJamBaseEventsByEventName(apiKey, phrase, quota, {
          eventType: 'festival',
          perPage: titlePerPage,
          eventDateFrom: fromDate,
        })
      : Promise.resolve([]),
  ]);
  let merged: Record<string, unknown>[] = [];
  for (const res of batchResults) {
    merged.push(...(res?.events ?? []));
  }
  merged.push(...titledEvents, ...festivalEvents);

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

/**
 * One JamBase `/events` call for typeahead / compact search (vs up to ~8 calls in tight mode).
 */
export async function buildFastJamBaseEventResults(
  apiKey: string,
  query: string,
  maxResults = 8,
  quota?: JamBaseQuotaContext,
): Promise<unknown[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  const phrase = jamBaseArtistVenueSearchPhrase(q);
  const fromDate = jamBaseEventDateFromToday();

  const perPage = String(Math.min(24, Math.max(maxResults, 8)));
  const wantFestivalTitle =
    isJamBaseFestivalEvent({ name: q }) || isJamBaseFestivalEvent({ name: phrase });
  const [byArtist, byTitle, byFestival] = await Promise.all([
    jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      apiKey,
      '/events',
      {
        artistName: phrase,
        eventDateFrom: fromDate,
        perPage,
        page: '1',
      },
      quota,
    ),
    fetchJamBaseEventsByEventName(apiKey, phrase, quota, {
      perPage,
      eventDateFrom: fromDate,
    }),
    wantFestivalTitle
      ? fetchJamBaseEventsByEventName(apiKey, phrase, quota, {
          eventType: 'festival',
          perPage,
          eventDateFrom: fromDate,
        })
      : Promise.resolve([]),
  ]);

  let merged = dedupeJamBaseEvents([
    ...(byArtist?.events ?? []),
    ...byTitle,
    ...byFestival,
  ]);
  merged = merged.filter((ev) => eventMatchesQuery(ev, qLower));
  merged.sort((a, b) => {
    const da = typeof a.startDate === 'string' ? a.startDate : '';
    const db = typeof b.startDate === 'string' ? b.startDate : '';
    return da.localeCompare(db);
  });
  return merged.slice(0, maxResults);
}

function asEventRecords(events: unknown[]): Record<string, unknown>[] {
  return events.filter(
    (ev): ev is Record<string, unknown> => typeof ev === 'object' && ev != null && !Array.isArray(ev),
  );
}

/**
 * Universal search / typeahead: upcoming matches plus past JamBase archive
 * and shows already saved in our library.
 */
export async function eventsForUniversalSearch(
  apiKey: string,
  query: string,
  upcoming: unknown[],
  maxResults: number,
  quota?: JamBaseQuotaContext,
  db?: D1Database,
): Promise<Record<string, unknown>[]> {
  const q = query.trim();
  if (q.length < 2 || maxResults <= 0) return [];
  const [past, library] = await Promise.all([
    apiKey
      ? buildPastJamBaseEventResults(apiKey, q, maxResults, quota)
      : Promise.resolve([] as Record<string, unknown>[]),
    db ? libraryEventsForFindAShow(db, q, maxResults) : Promise.resolve([] as Record<string, unknown>[]),
  ]);
  return mixFindAShowArchiveFirst(past, library, asEventRecords(upcoming), maxResults);
}
