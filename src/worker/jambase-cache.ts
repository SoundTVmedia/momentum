import { slugifyEntityName } from '../shared/jambase-slug';
import { jamBaseEventHeadliner, jamBaseEventVenueCoords } from '../shared/jambase-events';

type JamBaseCachedJson = Record<string, unknown> & { success?: boolean };

/** Upcoming event lists and geo queries are served from cache when fresher than this. */
export const JAMBASE_EVENT_CACHE_TTL_MS = 72 * 60 * 60 * 1000;

/** Treat a show as archival this long after its listed start (covers late encore). */
const PAST_EVENT_GRACE_MS = 12 * 60 * 60 * 1000;

const inflight = new Map<string, Promise<unknown>>();

export type JamBaseCacheMetricKind = 'hit' | 'upstream';

export type JamBaseArtistIdRow = {
  name_key: string;
  jambase_id: string;
  display_name: string | null;
  payload: string | null;
};

export type JamBaseVenueIdRow = {
  name_key: string;
  jambase_id: string;
  display_name: string | null;
  latitude: number | null;
  longitude: number | null;
  payload: string | null;
};

export type JamBaseEventCacheRow = {
  jambase_event_id: string;
  payload: string;
  start_date: string | null;
  artist_jambase_id: string | null;
  venue_jambase_id: string | null;
  fetched_at: string;
};

export function utcDayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function jamBaseNameKey(name: string): string {
  return slugifyEntityName(name);
}

export function jamBaseCityKey(city: string, countryIso2: string): string {
  return `${city.trim().toLowerCase()}|${countryIso2.trim().toUpperCase().slice(0, 2) || 'US'}`;
}

export function jamBaseEventListKey(kind: 'artist' | 'venue', jambaseId: string): string {
  return `${kind}:${jambaseId.trim()}`;
}

/** `/events?name=` title search (festivals and billed shows). */
export function jamBaseNameSearchListKey(name: string, eventType?: string): string {
  const n = jamBaseNameKey(name);
  const t = (eventType ?? '').trim().toLowerCase() || 'any';
  return `name:${n}:${t}`;
}

/** Festival page slug → cached JamBase event ids (year-stripped, same as `/festivals/:slug`). */
export function jamBaseFestivalPageListKey(slug: string): string {
  const key = jamBaseNameKey(slug).replace(/-20\d{2}$/, '').replace(/-19\d{2}$/, '');
  return key ? `festival:${key}` : '';
}

export function jamBaseGeoListKey(
  path: 'events' | 'venues',
  latitude: number,
  longitude: number,
  radiusMiles: string,
  extra = '',
): string {
  return `${path}:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${radiusMiles}:${extra}`;
}

/**
 * Classify a JamBase v3 path for metrics (per endpoint, per day).
 */
export function classifyJamBaseEndpoint(
  path: string,
  params: Record<string, string | undefined> = {},
): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/geographies/cities')) return 'GET /geographies/cities';
  if (/^\/artists\/[^/]+/.test(normalized)) return 'GET /artists/:id';
  if (/^\/venues\/[^/]+/.test(normalized)) return 'GET /venues/:id';
  if (/^\/events\/id\//.test(normalized) || /^\/events\/[^/]+$/.test(normalized)) {
    return 'GET /events/:id';
  }
  if (normalized === '/artists') return 'GET /artists';
  if (normalized === '/venues') {
    if (params.geoLatitude && params.geoLongitude) return 'GET /venues (geo)';
    if (params.geoCityName) return 'GET /venues (city)';
    return 'GET /venues';
  }
  if (normalized === '/events') {
    if (params.artistId) return 'GET /events (artist)';
    if (params.venueId) return 'GET /events (venue)';
    if (params.geoLatitude && params.geoLongitude) return 'GET /events (geo)';
    if (params.geoMetroId || params.geoCityId) return 'GET /events (metro)';
    if (params.name) {
      return params.eventType?.trim().toLowerCase() === 'festival'
        ? 'GET /events (festival name)'
        : 'GET /events (name)';
    }
    return 'GET /events';
  }
  return `GET ${normalized}`;
}

/**
 * Same-isolate coalescing key. Identical resources share one upstream call even when
 * perPage / expand flags differ.
 */
export function jamBaseCoalesceKey(
  path: string,
  params: Record<string, string | undefined> = {},
): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (/^\/artists\/([^/]+)/.test(normalized)) {
    return `id:artist:${decodeURIComponent(normalized.slice('/artists/'.length))}`;
  }
  if (/^\/venues\/([^/]+)/.test(normalized)) {
    return `id:venue:${decodeURIComponent(normalized.slice('/venues/'.length))}`;
  }
  if (/^\/events\/id\/(.+)/.test(normalized)) {
    return `id:event:${decodeURIComponent(normalized.slice('/events/id/'.length))}`;
  }
  if (/^\/events\/([^/]+)$/.test(normalized)) {
    return `id:event:${decodeURIComponent(normalized.slice('/events/'.length))}`;
  }
  if (normalized === '/artists' && params.artistName) {
    return `search:artist:${jamBaseNameKey(params.artistName)}`;
  }
  if (normalized === '/venues' && params.venueName && !params.geoLatitude) {
    return `search:venue:${jamBaseNameKey(params.venueName)}`;
  }
  if (normalized === '/events' && params.artistId) {
    return `events:artist:${params.artistId.trim()}`;
  }
  if (normalized === '/events' && params.venueId) {
    return `events:venue:${params.venueId.trim()}`;
  }
  if (normalized === '/events' && params.name) {
    return jamBaseNameSearchListKey(params.name, params.eventType);
  }
  if (normalized === '/events' && params.geoLatitude && params.geoLongitude) {
    return jamBaseGeoListKey(
      'events',
      Number(params.geoLatitude),
      Number(params.geoLongitude),
      params.geoRadiusAmount || '0',
      params.eventDateFrom || '',
    );
  }
  if (normalized === '/venues' && params.geoLatitude && params.geoLongitude) {
    return jamBaseGeoListKey(
      'venues',
      Number(params.geoLatitude),
      Number(params.geoLongitude),
      params.geoRadiusAmount || '0',
      '',
    );
  }
  if (normalized === '/geographies/cities' && params.geoCityName) {
    return `city:${jamBaseCityKey(params.geoCityName, params.geoCountryIso2 || 'US')}`;
  }
  const bits = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `${normalized}?${bits.join('&')}`;
}

export function jamBaseEventIsPast(
  startDate: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!startDate || typeof startDate !== 'string') return false;
  const startMs = Date.parse(startDate);
  if (!Number.isFinite(startMs)) return false;
  return startMs + PAST_EVENT_GRACE_MS < nowMs;
}

export function jamBaseCacheIsFresh(
  fetchedAt: string,
  startDate: string | null | undefined,
  nowMs = Date.now(),
  ttlMs = JAMBASE_EVENT_CACHE_TTL_MS,
): boolean {
  if (jamBaseEventIsPast(startDate, nowMs)) return true;
  const fetchedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedMs)) return false;
  return nowMs - fetchedMs < ttlMs;
}

export function jamBaseListCacheIsFresh(fetchedAt: string, nowMs = Date.now()): boolean {
  const fetchedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedMs)) return false;
  return nowMs - fetchedMs < JAMBASE_EVENT_CACHE_TTL_MS;
}

export async function coalesceInflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/** Test helper — not used in production. */
export function jamBaseInflightSize(): number {
  return inflight.size;
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function entityId(record: Record<string, unknown> | null | undefined): string | null {
  const id = record?.identifier;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function entityName(record: Record<string, unknown> | null | undefined): string | null {
  const name = record?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function venueCoordsFromRecord(record: Record<string, unknown>): {
  lat: number;
  lon: number;
} | null {
  const fromEventShape = jamBaseEventVenueCoords(record);
  if (fromEventShape) return fromEventShape;
  const addr = record.address as Record<string, unknown> | undefined;
  const ag = addr?.geo as Record<string, unknown> | undefined;
  if (ag) {
    const lat = Number(ag.latitude ?? ag.lat);
    const lon = Number(ag.longitude ?? ag.lon ?? ag.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const lat = Number(record.latitude ?? record.lat);
  const lon = Number(record.longitude ?? record.lon ?? record.lng);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
}

function eventArtistId(ev: Record<string, unknown>): string | null {
  return entityId(jamBaseEventHeadliner(ev));
}

function eventVenueId(ev: Record<string, unknown>): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  return entityId(loc);
}

function eventStartDate(ev: Record<string, unknown>): string | null {
  return typeof ev.startDate === 'string' && ev.startDate.trim() ? ev.startDate.trim() : null;
}

export async function recordJamBaseCacheMetric(
  db: D1Database,
  endpoint: string,
  kind: JamBaseCacheMetricKind,
): Promise<void> {
  const day = utcDayKey();
  const sql = `INSERT INTO jambase_cache_metrics (day, endpoint, upstream_calls, cache_hits)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(day, endpoint) DO UPDATE SET
      upstream_calls = upstream_calls + excluded.upstream_calls,
      cache_hits = cache_hits + excluded.cache_hits`;
  const upstream = kind === 'upstream' ? 1 : 0;
  const hits = kind === 'hit' ? 1 : 0;
  try {
    await db.prepare(sql).bind(day, endpoint, upstream, hits).run();
  } catch (e) {
    console.error('[JamBase] cache metric write failed (apply migration 71.sql?)', e);
  }
}

export async function lookupArtistIdByName(
  db: D1Database,
  name: string,
): Promise<JamBaseArtistIdRow | null> {
  const key = jamBaseNameKey(name);
  if (!key) return null;
  try {
    const row = await db
      .prepare(
        `SELECT name_key, jambase_id, display_name, payload
         FROM jambase_artist_ids WHERE name_key = ? LIMIT 1`,
      )
      .bind(key)
      .first<JamBaseArtistIdRow>();
    return row ?? null;
  } catch (e) {
    console.error('[JamBase] artist id lookup failed', e);
    return null;
  }
}

export async function lookupVenueIdByName(
  db: D1Database,
  name: string,
): Promise<JamBaseVenueIdRow | null> {
  const key = jamBaseNameKey(name);
  if (!key) return null;
  try {
    const row = await db
      .prepare(
        `SELECT name_key, jambase_id, display_name, latitude, longitude, payload
         FROM jambase_venue_ids WHERE name_key = ? LIMIT 1`,
      )
      .bind(key)
      .first<JamBaseVenueIdRow>();
    return row ?? null;
  } catch (e) {
    console.error('[JamBase] venue id lookup failed', e);
    return null;
  }
}

export async function lookupVenueGeoByJamBaseId(
  db: D1Database,
  jambaseId: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const id = jambaseId.trim();
  if (!id) return null;
  try {
    const row = await db
      .prepare(
        `SELECT latitude, longitude FROM jambase_venue_ids
         WHERE jambase_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
         LIMIT 1`,
      )
      .bind(id)
      .first<{ latitude: number; longitude: number }>();
    if (!row) return null;
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch (e) {
    console.error('[JamBase] venue geo lookup failed', e);
    return null;
  }
}

export async function upsertArtistId(
  db: D1Database,
  record: Record<string, unknown>,
  nameHint?: string,
): Promise<void> {
  const id = entityId(record);
  const name = entityName(record) ?? nameHint?.trim() ?? '';
  const key = jamBaseNameKey(name);
  if (!id || !key) return;
  const payload = JSON.stringify(record);
  try {
    await db
      .prepare(
        `INSERT INTO jambase_artist_ids (name_key, jambase_id, display_name, payload, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(name_key) DO UPDATE SET
           jambase_id = excluded.jambase_id,
           display_name = excluded.display_name,
           payload = excluded.payload,
           updated_at = datetime('now')`,
      )
      .bind(key, id, name, payload)
      .run();
  } catch (e) {
    console.error('[JamBase] artist id upsert failed', e);
  }
}

export async function upsertVenueId(
  db: D1Database,
  record: Record<string, unknown>,
  nameHint?: string,
): Promise<void> {
  const id = entityId(record);
  const name = entityName(record) ?? nameHint?.trim() ?? '';
  const key = jamBaseNameKey(name);
  if (!id || !key) return;
  const coords = venueCoordsFromRecord(record);
  const payload = JSON.stringify(record);
  try {
    await db
      .prepare(
        `INSERT INTO jambase_venue_ids
           (name_key, jambase_id, display_name, latitude, longitude, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(name_key) DO UPDATE SET
           jambase_id = excluded.jambase_id,
           display_name = excluded.display_name,
           latitude = COALESCE(excluded.latitude, jambase_venue_ids.latitude),
           longitude = COALESCE(excluded.longitude, jambase_venue_ids.longitude),
           payload = excluded.payload,
           updated_at = datetime('now')`,
      )
      .bind(key, id, name, coords?.lat ?? null, coords?.lon ?? null, payload)
      .run();
  } catch (e) {
    console.error('[JamBase] venue id upsert failed', e);
  }
}

export async function upsertCachedEvent(
  db: D1Database,
  ev: Record<string, unknown>,
  fetchedAt = new Date().toISOString(),
): Promise<void> {
  const id = entityId(ev);
  if (!id) return;
  const start = eventStartDate(ev);
  const artistId = eventArtistId(ev);
  const venueId = eventVenueId(ev);
  try {
    await db
      .prepare(
        `INSERT INTO jambase_events
           (jambase_event_id, payload, start_date, artist_jambase_id, venue_jambase_id, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(jambase_event_id) DO UPDATE SET
           payload = excluded.payload,
           start_date = excluded.start_date,
           artist_jambase_id = excluded.artist_jambase_id,
           venue_jambase_id = excluded.venue_jambase_id,
           fetched_at = excluded.fetched_at`,
      )
      .bind(id, JSON.stringify(ev), start, artistId, venueId, fetchedAt)
      .run();
  } catch (e) {
    console.error('[JamBase] event upsert failed', e);
  }
  const loc = ev.location;
  if (loc && typeof loc === 'object' && loc !== null) {
    await upsertVenueId(db, loc as Record<string, unknown>);
  }
  const head = jamBaseEventHeadliner(ev);
  if (head) await upsertArtistId(db, head);
}

async function upsertEventList(
  db: D1Database,
  listKey: string,
  events: Record<string, unknown>[],
  fetchedAt = new Date().toISOString(),
): Promise<void> {
  const ids = events.map((ev) => entityId(ev)).filter((id): id is string => Boolean(id));
  try {
    await db
      .prepare(
        `INSERT INTO jambase_event_lists (list_key, event_ids, fetched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(list_key) DO UPDATE SET
           event_ids = excluded.event_ids,
           fetched_at = excluded.fetched_at`,
      )
      .bind(listKey, JSON.stringify(ids), fetchedAt)
      .run();
  } catch (e) {
    console.error('[JamBase] event list upsert failed', e);
  }
  for (const ev of events) {
    await upsertCachedEvent(db, ev, fetchedAt);
  }
}

async function loadEventsByIds(
  db: D1Database,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const id of ids) {
    const row = await db
      .prepare(
        `SELECT payload FROM jambase_events WHERE jambase_event_id = ? LIMIT 1`,
      )
      .bind(id)
      .first<{ payload: string }>();
    const parsed = parseJsonObject(row?.payload ?? null);
    if (parsed) out.push(parsed);
  }
  return out;
}

async function readEventList(
  db: D1Database,
  listKey: string,
): Promise<Record<string, unknown>[] | null> {
  const row = await db
    .prepare(`SELECT event_ids, fetched_at FROM jambase_event_lists WHERE list_key = ? LIMIT 1`)
    .bind(listKey)
    .first<{ event_ids: string; fetched_at: string }>();
  if (!row || !jamBaseListCacheIsFresh(row.fetched_at)) return null;
  const ids = parseJsonArray(row.event_ids).filter((x): x is string => typeof x === 'string');
  const events = await loadEventsByIds(db, ids);
  return events;
}

/** Read a 72h JamBase event-id list (artist/venue calendars, name search, festival pages). */
export async function lookupCachedEventList(
  db: D1Database,
  listKey: string,
): Promise<Record<string, unknown>[] | null> {
  if (!listKey.trim()) return null;
  try {
    return await readEventList(db, listKey);
  } catch (e) {
    console.error('[JamBase] event list lookup failed', e);
    return null;
  }
}

/** Persist an event-id list plus each event payload (same tables as artist/venue calendars). */
export async function storeCachedEventList(
  db: D1Database,
  listKey: string,
  events: Record<string, unknown>[],
): Promise<void> {
  if (!listKey.trim() || events.length === 0) return;
  try {
    await upsertEventList(db, listKey, events);
  } catch (e) {
    console.error('[JamBase] event list store failed', e);
  }
}

async function readCachedEventById(
  db: D1Database,
  eventId: string,
): Promise<Record<string, unknown> | null> {
  const row = await db
    .prepare(
      `SELECT payload, start_date, fetched_at FROM jambase_events WHERE jambase_event_id = ? LIMIT 1`,
    )
    .bind(eventId)
    .first<{ payload: string; start_date: string | null; fetched_at: string }>();
  if (!row) return null;
  if (!jamBaseCacheIsFresh(row.fetched_at, row.start_date)) return null;
  return parseJsonObject(row.payload);
}

function unwrapEntityPayload(data: Record<string, unknown>, nestedKey: string): Record<string, unknown> | null {
  const nested = data[nestedKey];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  if (typeof data.identifier === 'string' || typeof data.name === 'string') return data;
  return null;
}

function pathEntityId(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  if (!rest || rest.includes('/')) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

/**
 * Serve a cached JamBase JSON body when the local tables allow it.
 * Returns null on miss / stale.
 */
export async function readJamBaseResponseCache(
  db: D1Database,
  path: string,
  params: Record<string, string | undefined>,
): Promise<JamBaseCachedJson | null> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  try {
    if (normalized.startsWith('/geographies/cities') && params.geoCityName) {
      const cityKey = jamBaseCityKey(params.geoCityName, params.geoCountryIso2 || 'US');
      const row = await db
        .prepare(`SELECT payload FROM jambase_geo_cities WHERE city_key = ? LIMIT 1`)
        .bind(cityKey)
        .first<{ payload: string | null }>();
      const parsed = parseJsonObject(row?.payload ?? null);
      if (parsed) return parsed as JamBaseCachedJson;
      return null;
    }

    const artistIdPath = pathEntityId(normalized, '/artists/');
    if (artistIdPath) {
      const row = await db
        .prepare(
          `SELECT payload FROM jambase_artist_ids WHERE jambase_id = ? AND payload IS NOT NULL LIMIT 1`,
        )
        .bind(artistIdPath)
        .first<{ payload: string }>();
      return parseJsonObject(row?.payload ?? null) as JamBaseCachedJson | null;
    }

    const venueIdPath = pathEntityId(normalized, '/venues/');
    if (venueIdPath) {
      const row = await db
        .prepare(
          `SELECT payload FROM jambase_venue_ids WHERE jambase_id = ? AND payload IS NOT NULL LIMIT 1`,
        )
        .bind(venueIdPath)
        .first<{ payload: string }>();
      return parseJsonObject(row?.payload ?? null) as JamBaseCachedJson | null;
    }

    let eventIdPath: string | null = null;
    if (normalized.startsWith('/events/id/')) {
      eventIdPath = decodeURIComponent(normalized.slice('/events/id/'.length));
    } else {
      const rest = pathEntityId(normalized, '/events/');
      if (rest) eventIdPath = rest;
    }
    if (eventIdPath) {
      const ev = await readCachedEventById(db, eventIdPath);
      if (!ev) return null;
      return { event: ev, identifier: ev.identifier, success: true } as JamBaseCachedJson;
    }

    if (normalized === '/events' && params.artistId) {
      const events = await readEventList(db, jamBaseEventListKey('artist', params.artistId));
      if (events) return { events, success: true } as JamBaseCachedJson;
      return null;
    }
    if (normalized === '/events' && params.venueId) {
      const events = await readEventList(db, jamBaseEventListKey('venue', params.venueId));
      if (events) return { events, success: true } as JamBaseCachedJson;
      return null;
    }
    if (normalized === '/events' && params.geoLatitude && params.geoLongitude) {
      const key = jamBaseGeoListKey(
        'events',
        Number(params.geoLatitude),
        Number(params.geoLongitude),
        params.geoRadiusAmount || '0',
        params.eventDateFrom || '',
      );
      const events = await readEventList(db, key);
      if (events) return { events, success: true } as JamBaseCachedJson;
      return null;
    }
    if (normalized === '/events' && params.name) {
      const events = await readEventList(
        db,
        jamBaseNameSearchListKey(params.name, params.eventType),
      );
      if (events) return { events, success: true } as JamBaseCachedJson;
      return null;
    }
    if (normalized === '/venues' && params.geoLatitude && params.geoLongitude && !params.venueName) {
      const key = jamBaseGeoListKey(
        'venues',
        Number(params.geoLatitude),
        Number(params.geoLongitude),
        params.geoRadiusAmount || '0',
        '',
      );
      const row = await db
        .prepare(`SELECT event_ids, fetched_at FROM jambase_event_lists WHERE list_key = ? LIMIT 1`)
        .bind(key)
        .first<{ event_ids: string; fetched_at: string }>();
      if (!row || !jamBaseListCacheIsFresh(row.fetched_at)) return null;
      const venues = parseJsonArray(row.event_ids).filter(
        (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
      );
      return { venues, success: true } as JamBaseCachedJson;
    }

    return null;
  } catch (e) {
    console.error('[JamBase] cache read failed', e);
    return null;
  }
}

function recordsFromList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

/**
 * Persist upstream JSON into the permanent / 72h tables. Never used for bulk catalog download.
 */
export async function storeJamBaseResponseCache(
  db: D1Database,
  path: string,
  params: Record<string, string | undefined>,
  json: JamBaseCachedJson,
): Promise<void> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const fetchedAt = new Date().toISOString();
  try {
    if (normalized.startsWith('/geographies/cities') && params.geoCityName) {
      const cityKey = jamBaseCityKey(params.geoCityName, params.geoCountryIso2 || 'US');
      const cities = recordsFromList((json as { cities?: unknown }).cities);
      const first = cities[0];
      const cityId = entityId(first) ?? '';
      await db
        .prepare(
          `INSERT INTO jambase_geo_cities (city_key, city_id, payload)
           VALUES (?, ?, ?)
           ON CONFLICT(city_key) DO UPDATE SET
             city_id = excluded.city_id,
             payload = excluded.payload`,
        )
        .bind(cityKey, cityId, JSON.stringify(json))
        .run();
      return;
    }

    const artistIdPath = pathEntityId(normalized, '/artists/');
    if (artistIdPath) {
      const entity = unwrapEntityPayload(json, 'artist') ?? json;
      await upsertArtistId(db, entity);
      return;
    }

    const venueIdPath = pathEntityId(normalized, '/venues/');
    if (venueIdPath) {
      const entity = unwrapEntityPayload(json, 'venue') ?? json;
      await upsertVenueId(db, entity);
      return;
    }

    let eventIdPath: string | null = null;
    if (normalized.startsWith('/events/id/')) {
      eventIdPath = decodeURIComponent(normalized.slice('/events/id/'.length));
    } else {
      const rest = pathEntityId(normalized, '/events/');
      if (rest) eventIdPath = rest;
    }
    if (eventIdPath) {
      const ev = unwrapEntityPayload(json, 'event') ?? json;
      await upsertCachedEvent(db, ev, fetchedAt);
      return;
    }

    if (normalized === '/artists') {
      for (const artist of recordsFromList((json as { artists?: unknown }).artists)) {
        await upsertArtistId(db, artist);
      }
      return;
    }

    if (normalized === '/venues') {
      const venues = recordsFromList((json as { venues?: unknown }).venues);
      for (const venue of venues) {
        await upsertVenueId(db, venue);
      }
      if (params.geoLatitude && params.geoLongitude && !params.venueName) {
        const key = jamBaseGeoListKey(
          'venues',
          Number(params.geoLatitude),
          Number(params.geoLongitude),
          params.geoRadiusAmount || '0',
          '',
        );
        await db
          .prepare(
            `INSERT INTO jambase_event_lists (list_key, event_ids, fetched_at)
             VALUES (?, ?, ?)
             ON CONFLICT(list_key) DO UPDATE SET
               event_ids = excluded.event_ids,
               fetched_at = excluded.fetched_at`,
          )
          .bind(key, JSON.stringify(venues), fetchedAt)
          .run();
      }
      return;
    }

    if (normalized === '/events') {
      const events = recordsFromList((json as { events?: unknown }).events);
      if (params.artistId) {
        await upsertEventList(db, jamBaseEventListKey('artist', params.artistId), events, fetchedAt);
      } else if (params.venueId) {
        await upsertEventList(db, jamBaseEventListKey('venue', params.venueId), events, fetchedAt);
      } else if (params.geoLatitude && params.geoLongitude) {
        const key = jamBaseGeoListKey(
          'events',
          Number(params.geoLatitude),
          Number(params.geoLongitude),
          params.geoRadiusAmount || '0',
          params.eventDateFrom || '',
        );
        await upsertEventList(db, key, events, fetchedAt);
      } else if (params.name) {
        await upsertEventList(
          db,
          jamBaseNameSearchListKey(params.name, params.eventType),
          events,
          fetchedAt,
        );
      } else {
        for (const ev of events) {
          await upsertCachedEvent(db, ev, fetchedAt);
        }
      }
    }
  } catch (e) {
    console.error('[JamBase] cache store failed', e);
  }
}

export type JamBaseMetricsRow = {
  day: string;
  endpoint: string;
  upstream_calls: number;
  cache_hits: number;
};

export async function loadJamBaseCacheMetrics(
  db: D1Database,
  days = 14,
): Promise<{
  rows: JamBaseMetricsRow[];
  todayUpstream: number;
  todayHits: number;
  windowUpstream: number;
  windowHits: number;
}> {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (Math.max(1, days) - 1));
  const startDay = start.toISOString().slice(0, 10);
  const today = utcDayKey();
  try {
    const res = await db
      .prepare(
        `SELECT day, endpoint, upstream_calls, cache_hits
         FROM jambase_cache_metrics
         WHERE day >= ?
         ORDER BY day DESC, endpoint ASC`,
      )
      .bind(startDay)
      .all<JamBaseMetricsRow>();
    const rows = (res.results ?? []) as JamBaseMetricsRow[];
    let todayUpstream = 0;
    let todayHits = 0;
    let windowUpstream = 0;
    let windowHits = 0;
    for (const row of rows) {
      windowUpstream += Number(row.upstream_calls) || 0;
      windowHits += Number(row.cache_hits) || 0;
      if (row.day === today) {
        todayUpstream += Number(row.upstream_calls) || 0;
        todayHits += Number(row.cache_hits) || 0;
      }
    }
    return { rows, todayUpstream, todayHits, windowUpstream, windowHits };
  } catch (e) {
    console.error('[JamBase] metrics read failed', e);
    return { rows: [], todayUpstream: 0, todayHits: 0, windowUpstream: 0, windowHits: 0 };
  }
}

/** Copy JamBase IDs already stored on clips / venues into the permanent maps (no upstream calls). */
export async function seedJamBaseIdCachesFromLocal(db: D1Database): Promise<{ artists: number; venues: number }> {
  let artists = 0;
  let venues = 0;
  try {
    const clipArtists = await db
      .prepare(
        `SELECT DISTINCT TRIM(artist_name) AS name, TRIM(jambase_artist_id) AS jambase_id
         FROM clips
         WHERE TRIM(IFNULL(jambase_artist_id, '')) != ''
           AND TRIM(IFNULL(artist_name, '')) != ''
         LIMIT 500`,
      )
      .all<{ name: string; jambase_id: string }>();
    for (const row of clipArtists.results ?? []) {
      const key = jamBaseNameKey(row.name);
      const id = row.jambase_id?.trim();
      if (!key || !id) continue;
      await db
        .prepare(
          `INSERT INTO jambase_artist_ids (name_key, jambase_id, display_name)
           VALUES (?, ?, ?)
           ON CONFLICT(name_key) DO UPDATE SET
             jambase_id = excluded.jambase_id,
             display_name = COALESCE(jambase_artist_ids.display_name, excluded.display_name)`,
        )
        .bind(key, id, row.name)
        .run();
      artists += 1;
    }

    const clipVenues = await db
      .prepare(
        `SELECT DISTINCT TRIM(venue_name) AS name, TRIM(jambase_venue_id) AS jambase_id
         FROM clips
         WHERE TRIM(IFNULL(jambase_venue_id, '')) != ''
           AND TRIM(IFNULL(venue_name, '')) != ''
         LIMIT 500`,
      )
      .all<{ name: string; jambase_id: string }>();
    for (const row of clipVenues.results ?? []) {
      const key = jamBaseNameKey(row.name);
      const id = row.jambase_id?.trim();
      if (!key || !id) continue;
      await db
        .prepare(
          `INSERT INTO jambase_venue_ids (name_key, jambase_id, display_name)
           VALUES (?, ?, ?)
           ON CONFLICT(name_key) DO UPDATE SET
             jambase_id = excluded.jambase_id,
             display_name = COALESCE(jambase_venue_ids.display_name, excluded.display_name)`,
        )
        .bind(key, id, row.name)
        .run();
      venues += 1;
    }

    const localVenues = await db
      .prepare(
        `SELECT name, jambase_id FROM venues
         WHERE TRIM(IFNULL(jambase_id, '')) != '' AND TRIM(IFNULL(name, '')) != ''
         LIMIT 500`,
      )
      .all<{ name: string; jambase_id: string }>();
    for (const row of localVenues.results ?? []) {
      const key = jamBaseNameKey(row.name);
      const id = row.jambase_id?.trim();
      if (!key || !id) continue;
      await db
        .prepare(
          `INSERT INTO jambase_venue_ids (name_key, jambase_id, display_name)
           VALUES (?, ?, ?)
           ON CONFLICT(name_key) DO UPDATE SET
             jambase_id = excluded.jambase_id,
             display_name = COALESCE(jambase_venue_ids.display_name, excluded.display_name)`,
        )
        .bind(key, id, row.name)
        .run();
      venues += 1;
    }
  } catch (e) {
    console.error('[JamBase] seed id caches failed', e);
  }
  return { artists, venues };
}
