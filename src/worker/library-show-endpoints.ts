import type { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';
import { fetchJamBaseEventById } from './jambase-endpoints';
import { jamBaseQuotaFromEnv, normalizeJamBaseApiKey } from './jambase-client';
import { upsertCachedEvent } from './jambase-cache';
import { findExistingLibraryShow } from './past-show-list';
import { libraryShowStubSelectSql, type PastShowListRow } from './past-show-sql';
import {
  jamBaseEventArtistName,
  jamBaseEventId,
  jamBaseEventImageUrl,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
} from '../shared/jambase-events';
import { jamBaseEventIsConcluded } from '../shared/jambase-event-day';
import {
  applyStoredSetlistToEvent,
  jamBaseEventSetlist,
  serializeStoredSetlist,
} from '../shared/jambase-setlist';
import { jamBaseEventTitle, artistAtVenueTitle } from '../shared/event-title';
import { showNightKey } from '../shared/show-night-key';
import { loadSetlistFromJamBaseShowHtml } from './jambase-show-html';

function eventArtistId(ev: Record<string, unknown>): string | null {
  const perf = ev.performer;
  if (!Array.isArray(perf)) return null;
  for (const p of perf) {
    if (p && typeof p === 'object') {
      const id = (p as Record<string, unknown>).identifier;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  }
  return null;
}

function eventVenueId(ev: Record<string, unknown>): string | null {
  const loc = ev.location;
  if (loc && typeof loc === 'object') {
    const id = (loc as Record<string, unknown>).identifier;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

function payloadFromBody(body: Record<string, unknown>, eventId: string): Record<string, unknown> | null {
  const raw = body.event;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ev = raw as Record<string, unknown>;
  const id = jamBaseEventId(ev);
  if (id && id !== eventId) return null;
  return ev;
}

export function libraryShowRowFromEvent(
  ev: Record<string, unknown>,
  addedBy: string,
  htmlChecked = false,
): {
  jambase_event_id: string;
  artist_name: string;
  venue_name: string | null;
  venue_location: string | null;
  start_date: string | null;
  event_title: string;
  thumbnail_url: string | null;
  jambase_artist_id: string | null;
  jambase_venue_id: string | null;
  setlist_json: string | null;
  payload: string;
  added_by: string;
} | null {
  const eventId = jamBaseEventId(ev);
  const artistName = jamBaseEventArtistName(ev);
  if (!eventId || !artistName) return null;
  const venueName = jamBaseEventVenueName(ev);
  const venueLabel = venueName === 'Venue TBA' ? '' : venueName;
  const startDate = typeof ev.startDate === 'string' ? ev.startDate.trim() : '';
  const eventTitle =
    jamBaseEventTitle(ev) ?? artistAtVenueTitle(artistName, venueLabel) ?? artistName;
  return {
    jambase_event_id: eventId,
    artist_name: artistName,
    venue_name: venueLabel || null,
    venue_location: jamBaseEventVenueCityLine(ev) || null,
    start_date: startDate || null,
    event_title: eventTitle,
    thumbnail_url: jamBaseEventImageUrl(ev),
    jambase_artist_id: eventArtistId(ev),
    jambase_venue_id: eventVenueId(ev),
    setlist_json: serializeStoredSetlist(ev, htmlChecked),
    payload: JSON.stringify(ev),
    added_by: addedBy,
  };
}

export function pastShowSummaryFromLibraryRow(row: PastShowListRow): PastShowListRow {
  return {
    ...row,
    clip_count: Number(row.clip_count) || 0,
  };
}

function alreadyAddedPayload(show: PastShowListRow) {
  return {
    error: 'This show is already in the library',
    alreadyAdded: true,
    show: pastShowSummaryFromLibraryRow(show),
  };
}

/** POST /api/library-shows — persist a past JamBase event as a show card/page. */
export async function createLibraryShow(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);
  const uid = mochaUserIdKey(mochaUser);

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const eventIdRaw =
    (typeof body.jambase_event_id === 'string' && body.jambase_event_id.trim()) ||
    (typeof body.eventId === 'string' && body.eventId.trim()) ||
    '';
  if (!eventIdRaw) {
    return c.json({ error: 'jambase_event_id is required' }, 400);
  }

  const key = normalizeJamBaseApiKey(c.env.JAMBASE_API_KEY);
  let ev: Record<string, unknown> | null = null;
  if (key) {
    try {
      ev = await fetchJamBaseEventById(key, jamBaseQuotaFromEnv(c.env), eventIdRaw, {
        skipResponseCache: true,
      });
    } catch (err) {
      console.error('createLibraryShow fetch event', err);
    }
  }
  if (!ev) ev = payloadFromBody(body, eventIdRaw);
  if (!ev) {
    return c.json({ error: 'JamBase event not found' }, 404);
  }

  const storedSetlist = await loadSetlistFromJamBaseShowHtml(ev);
  ev = applyStoredSetlistToEvent(ev, storedSetlist);

  const eventId = jamBaseEventId(ev) || eventIdRaw;
  if (!jamBaseEventIsConcluded(ev)) {
    return c.json({ error: 'Only past shows can be added from the archive' }, 400);
  }

  const nightKey = showNightKey(
    jamBaseEventArtistName(ev),
    jamBaseEventVenueName(ev) === 'Venue TBA' ? '' : jamBaseEventVenueName(ev),
    typeof ev.startDate === 'string' ? ev.startDate : null,
  );

  try {
    const existing = await findExistingLibraryShow(c.env.DB, eventId, nightKey);
    if (existing) {
      return c.json(alreadyAddedPayload(existing), 409);
    }

    const row = libraryShowRowFromEvent(ev, uid, storedSetlist.htmlChecked === true);
    if (!row) {
      return c.json({ error: 'Event is missing artist or id' }, 400);
    }

    await upsertCachedEvent(c.env.DB, ev);

    await c.env.DB
      .prepare(
        `INSERT INTO library_shows (
           jambase_event_id, artist_name, venue_name, venue_location, start_date,
           event_title, thumbnail_url, jambase_artist_id, jambase_venue_id,
           setlist_json, payload, added_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.jambase_event_id,
        row.artist_name,
        row.venue_name,
        row.venue_location,
        row.start_date,
        row.event_title,
        row.thumbnail_url,
        row.jambase_artist_id,
        row.jambase_venue_id,
        row.setlist_json,
        row.payload,
        row.added_by,
      )
      .run();

    const saved = await c.env.DB
      .prepare(
        `SELECT ${libraryShowStubSelectSql()}
         FROM library_shows
         WHERE jambase_event_id = ?
         LIMIT 1`,
      )
      .bind(eventId)
      .first<PastShowListRow>();

    return c.json(
      {
        ok: true,
        alreadyAdded: false,
        show: saved ? pastShowSummaryFromLibraryRow(saved) : {
          show_id: row.jambase_event_id,
          event_title: row.event_title,
          artist_name: row.artist_name,
          show_date: row.start_date,
          venue_name: row.venue_name,
          venue_location: row.venue_location,
          jambase_event_id: row.jambase_event_id,
          jambase_venue_id: row.jambase_venue_id,
          jambase_artist_id: row.jambase_artist_id,
          clip_count: 0,
          thumbnail_url: row.thumbnail_url,
        },
        setlist: jamBaseEventSetlist(ev),
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(message)) {
      const existing = await findExistingLibraryShow(c.env.DB, eventId, nightKey);
      if (existing) return c.json(alreadyAddedPayload(existing), 409);
    }
    console.error('createLibraryShow', err);
    return c.json({ error: 'Failed to add past show' }, 500);
  }
}
