import type { Context } from 'hono';
import {
  archivalShowDateKey,
  isArchivalShowId,
  newArchivalShowId,
} from '../shared/archival-show';
import { mochaUserIdKey, normalizeArtistDisplayName } from './favorite-artists-sync';
import { fetchJamBaseEventById, fetchJamBaseEventsByArtistName } from './jambase-endpoints';
import { jamBaseQuotaFromEnv, normalizeJamBaseApiKey } from './jambase-client';

function eventVenueName(ev: Record<string, unknown>): string {
  const loc = ev.location;
  if (loc && typeof loc === 'object') {
    const name = (loc as Record<string, unknown>).name;
    if (typeof name === 'string') return name.trim();
  }
  return '';
}

function eventArtistName(ev: Record<string, unknown>): string {
  const perf = ev.performer;
  if (Array.isArray(perf)) {
    for (const p of perf) {
      if (p && typeof p === 'object') {
        const name = (p as Record<string, unknown>).name;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    }
  }
  return typeof ev.name === 'string' ? ev.name : '';
}

function eventCity(ev: Record<string, unknown>): string {
  const loc = ev.location;
  if (loc && typeof loc === 'object') {
    const row = loc as Record<string, unknown>;
    const addr = row.address;
    if (addr && typeof addr === 'object') {
      const city = (addr as Record<string, unknown>).addressLocality;
      if (typeof city === 'string') return city;
    }
    if (typeof row.addressLocality === 'string') return row.addressLocality;
  }
  return '';
}

function namesClose(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** POST /api/archival-shows/match — JamBase artist + venue + date. */
export async function matchArchivalShow(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const artist = normalizeArtistDisplayName(
    typeof body.artist === 'string' ? body.artist : typeof body.artist_name === 'string' ? body.artist_name : '',
  );
  const venue = typeof body.venue === 'string'
    ? body.venue.trim()
    : typeof body.venue_name === 'string'
      ? body.venue_name.trim()
      : '';
  const date = archivalShowDateKey(
    typeof body.date === 'string' ? body.date : typeof body.start_date === 'string' ? body.start_date : '',
  );

  if (!artist || !venue || !date) {
    return c.json({ error: 'artist, venue, and date are required' }, 400);
  }

  const key = normalizeJamBaseApiKey(c.env.JAMBASE_API_KEY);
  if (!key) {
    return c.json({ match: null, matches: [] });
  }

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const { events } = await fetchJamBaseEventsByArtistName(key, jbQ, artist, '40');
    const matches = events.filter((ev) => {
      const evDate = archivalShowDateKey(
        typeof ev.startDate === 'string' ? ev.startDate : String(ev.startDate ?? ''),
      );
      return evDate === date && namesClose(eventVenueName(ev), venue);
    });

    return c.json({
      match: matches[0] ?? null,
      matches,
    });
  } catch (err) {
    console.error('matchArchivalShow', err);
    return c.json({ match: null, matches: [], error: 'JamBase match failed' }, 200);
  }
}

/** POST /api/archival-shows — save a matched JamBase event or a user-supplied show. */
export async function createArchivalShow(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);
  const uid = mochaUserIdKey(mochaUser);

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const str = (k: string) => {
    const v = body[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  let eventId = str('jambase_event_id');
  let artistName = str('artist_name') || str('artist');
  let venueName = str('venue_name') || str('venue');
  let venueLocation = str('city') || str('venue_location');
  let startDate = archivalShowDateKey(str('start_date') || str('date'));
  let eventTitle = str('event_title');
  let jambaseVenueId = str('jambase_venue_id');
  let jambaseArtistId = str('jambase_artist_id');
  const setlistNotes = str('setlist_notes');
  const stubImageUrl = str('stub_image_url');
  const stubR2Key = str('stub_r2_key');
  let isUserSupplied = true;

  const key = normalizeJamBaseApiKey(c.env.JAMBASE_API_KEY);
  if (eventId && !isArchivalShowId(eventId) && key) {
    const jb = await fetchJamBaseEventById(key, jamBaseQuotaFromEnv(c.env), eventId);
    if (jb) {
      isUserSupplied = false;
      artistName = eventArtistName(jb) || artistName;
      venueName = eventVenueName(jb) || venueName;
      venueLocation = eventCity(jb) || venueLocation;
      startDate = archivalShowDateKey(
        typeof jb.startDate === 'string' ? jb.startDate : startDate,
      );
      eventTitle = typeof jb.name === 'string' ? jb.name : eventTitle;
      const loc = jb.location && typeof jb.location === 'object'
        ? (jb.location as Record<string, unknown>)
        : null;
      if (typeof loc?.identifier === 'string') jambaseVenueId = loc.identifier;
      const perf = Array.isArray(jb.performer) ? jb.performer[0] : null;
      if (perf && typeof perf === 'object') {
        const id = (perf as Record<string, unknown>).identifier;
        if (typeof id === 'string') jambaseArtistId = id;
      }
    }
  }

  if (!artistName || !venueName || !startDate) {
    return c.json({ error: 'artist, venue, and date are required' }, 400);
  }

  if (!eventId) eventId = newArchivalShowId();
  eventTitle = eventTitle || `${artistName} at ${venueName}`;

  try {
    await c.env.DB
      .prepare(
        `INSERT INTO user_show_marks (
           mocha_user_id, status, jambase_event_id, jambase_venue_id, jambase_artist_id,
           event_title, artist_name, venue_name, venue_location, start_date,
           is_user_supplied, setlist_notes, stub_image_url, stub_r2_key, updated_at
         ) VALUES (?, 'attended', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(mocha_user_id, jambase_event_id) DO UPDATE SET
           artist_name = excluded.artist_name,
           venue_name = excluded.venue_name,
           venue_location = COALESCE(excluded.venue_location, user_show_marks.venue_location),
           start_date = excluded.start_date,
           event_title = COALESCE(excluded.event_title, user_show_marks.event_title),
           is_user_supplied = excluded.is_user_supplied,
           setlist_notes = COALESCE(excluded.setlist_notes, user_show_marks.setlist_notes),
           stub_image_url = COALESCE(excluded.stub_image_url, user_show_marks.stub_image_url),
           stub_r2_key = COALESCE(excluded.stub_r2_key, user_show_marks.stub_r2_key),
           updated_at = datetime('now')`,
      )
      .bind(
        uid,
        eventId,
        jambaseVenueId,
        jambaseArtistId,
        eventTitle,
        artistName,
        venueName,
        venueLocation,
        startDate,
        isUserSupplied ? 1 : 0,
        setlistNotes,
        stubImageUrl,
        stubR2Key,
      )
      .run();

    try {
      await c.env.DB
        .prepare(
          `INSERT INTO user_favorites (mocha_user_id, favorite_type, entity_key, display_name, metadata_json)
           VALUES (?, 'archival_show', ?, ?, ?)
           ON CONFLICT(mocha_user_id, favorite_type, entity_key) DO UPDATE SET
             display_name = excluded.display_name,
             metadata_json = excluded.metadata_json`,
        )
        .bind(
          uid,
          eventId,
          eventTitle,
          JSON.stringify({
            artist_name: artistName,
            venue_name: venueName,
            start_date: startDate,
            stub_image_url: stubImageUrl,
          }),
        )
        .run();
    } catch (favErr) {
      const message = favErr instanceof Error ? favErr.message : String(favErr);
      if (!/no such table: user_favorites/i.test(message)) throw favErr;
    }

    const row = await c.env.DB
      .prepare(`SELECT * FROM user_show_marks WHERE mocha_user_id = ? AND jambase_event_id = ?`)
      .bind(uid, eventId)
      .first();

    return c.json({ ok: true, mark: row, user_supplied: isUserSupplied });
  } catch (err) {
    console.error('createArchivalShow', err);
    return c.json({ error: 'Failed to save archival show' }, 500);
  }
}
