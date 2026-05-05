import type { Context } from 'hono';
import { normalizeClipApiRows } from './clip-row-normalize';
import { jamBaseFetch, jamBaseEventDateFromToday } from './jambase-client';
import { jamBaseEventToTourDateRow, jamBaseEventToVenueUpcomingRow } from './jambase-map';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
  titleCaseWords,
} from '../shared/jambase-slug';

export async function resolveArtistNameForClipsQuery(
  db: D1Database,
  apiKey: string | undefined,
  routeParam: string
): Promise<string> {
  const slug = normalizedSlugFromRouteParam(routeParam);
  if (!slug) return '';

  const clip = await db
    .prepare(
      `SELECT artist_name FROM clips WHERE artist_name IS NOT NULL AND TRIM(artist_name) != ''
       AND LOWER(REPLACE(TRIM(artist_name), ' ', '-')) = ?
       LIMIT 1`
    )
    .bind(slug)
    .first<{ artist_name: string }>();
  if (clip?.artist_name) return clip.artist_name;

  const row = await db
    .prepare(
      `SELECT name FROM artists WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ? LIMIT 1`
    )
    .bind(slug)
    .first<{ name: string }>();
  if (row?.name) return row.name;

  const phrase = searchPhraseFromSlug(slug);
  if (apiKey?.trim()) {
    const data = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(apiKey, '/artists', {
      artistName: phrase,
      perPage: '15',
      page: '1',
    });
    const artists = data?.artists ?? [];
    if (artists.length) {
      const exact = artists.find((a) => slugifyEntityName(String(a.name)) === slug);
      const pick = exact ?? artists[0];
      if (pick && typeof pick.name === 'string') return pick.name;
    }
  }

  return titleCaseWords(phrase);
}

export async function resolveVenueNameForClipsQuery(
  db: D1Database,
  apiKey: string | undefined,
  routeParam: string
): Promise<string> {
  const slug = normalizedSlugFromRouteParam(routeParam);
  if (!slug) return '';

  const clip = await db
    .prepare(
      `SELECT venue_name FROM clips WHERE venue_name IS NOT NULL AND TRIM(venue_name) != ''
       AND LOWER(REPLACE(TRIM(venue_name), ' ', '-')) = ?
       LIMIT 1`
    )
    .bind(slug)
    .first<{ venue_name: string }>();
  if (clip?.venue_name) return clip.venue_name;

  const row = await db
    .prepare(
      `SELECT name FROM venues WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ? LIMIT 1`
    )
    .bind(slug)
    .first<{ name: string }>();
  if (row?.name) return row.name;

  const phrase = searchPhraseFromSlug(slug);
  if (apiKey?.trim()) {
    const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(apiKey, '/venues', {
      venueName: phrase,
      perPage: '15',
      page: '1',
    });
    const venues = data?.venues ?? [];
    if (venues.length) {
      const exact = venues.find((v) => slugifyEntityName(String(v.name)) === slug);
      const pick = exact ?? venues[0];
      if (pick && typeof pick.name === 'string') return pick.name;
    }
  }

  return titleCaseWords(phrase);
}

export async function buildArtistPagePayload(c: Context): Promise<Record<string, unknown>> {
  const param = (c.req.param('artistName') ?? '').trim();
  let slug = normalizedSlugFromRouteParam(param);
  if (!slug && param) {
    slug = slugifyEntityName(param);
  }
  const apiKey = c.env.JAMBASE_API_KEY;
  const db = c.env.DB;

  let jambaseArtist: Record<string, unknown> | null = null;
  const phrase = searchPhraseFromSlug(slug);

  if (apiKey?.trim() && phrase) {
    const list = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(apiKey, '/artists', {
      artistName: phrase,
      perPage: '20',
      page: '1',
    });
    const artists = list?.artists ?? [];
    if (artists.length) {
      jambaseArtist =
        artists.find((a) => slugifyEntityName(String(a.name)) === slug) ?? artists[0];
    }
  }

  let canonicalName = jambaseArtist?.name
    ? String(jambaseArtist.name).trim()
    : (await resolveArtistNameForClipsQuery(db, apiKey, param)).trim();

  if (!canonicalName) {
    canonicalName =
      titleCaseWords(searchPhraseFromSlug(slug)) ||
      param ||
      (jambaseArtist && typeof jambaseArtist.name === 'string' ? jambaseArtist.name : '') ||
      'Artist';
  }

  let artist = (await db
    .prepare(
      `SELECT * FROM artists WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ? OR name = ? LIMIT 1`
    )
    .bind(slug, canonicalName)
    .first()) as Record<string, unknown> | null;

  if (!artist && canonicalName) {
    try {
      const ins = await db
        .prepare(
          `INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .bind(canonicalName)
        .run();
      if (ins.success) {
        const lid = ins.meta?.last_row_id;
        if (lid != null && lid !== '') {
          artist = (await db
            .prepare('SELECT * FROM artists WHERE id = ?')
            .bind(Number(lid))
            .first()) as Record<string, unknown> | null;
        }
      }
    } catch (err) {
      console.error('Artist INSERT failed (likely duplicate):', err);
    }
  }

  if (!artist && canonicalName) {
    artist = (await db
      .prepare(
        `SELECT * FROM artists WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ? OR name = ? ORDER BY id DESC LIMIT 1`
      )
      .bind(slug, canonicalName)
      .first()) as Record<string, unknown> | null;
  }

  if (
    artist &&
    jambaseArtist &&
    typeof jambaseArtist.image === 'string' &&
    jambaseArtist.image.length > 0 &&
    !artist.image_url
  ) {
    await db
      .prepare(`UPDATE artists SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(jambaseArtist.image, artist.id)
      .run();
    artist = (await db
      .prepare('SELECT * FROM artists WHERE id = ?')
      .bind(artist.id)
      .first()) as Record<string, unknown> | null;
  }

  if (!artist) {
    const nameForDisplay =
      (jambaseArtist && typeof jambaseArtist.name === 'string' && jambaseArtist.name) ||
      canonicalName ||
      'Artist';
    const img =
      jambaseArtist && typeof jambaseArtist.image === 'string' ? jambaseArtist.image : null;
    const web = jambaseArtist && typeof jambaseArtist.url === 'string' ? jambaseArtist.url : null;
    artist = {
      id: 0,
      name: nameForDisplay,
      bio: null,
      image_url: img,
      social_links: web ? JSON.stringify({ website: web }) : null,
      is_verified: 0,
      created_at: '',
      updated_at: '',
    };
  } else {
    artist = {
      ...artist,
      social_links: artist.social_links ?? null,
      bio: artist.bio ?? null,
      image_url: artist.image_url ?? null,
      is_verified: artist.is_verified ?? 0,
    };
  }

  const clipsRes = await db
    .prepare(
      `SELECT 
        clips.rowid AS _clipRowId,
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.is_hidden = 0
      AND (
        LOWER(REPLACE(TRIM(IFNULL(clips.artist_name, '')), ' ', '-')) = ?
        OR clips.artist_name = ?
      )
      ORDER BY clips.created_at DESC
      LIMIT 50`
    )
    .bind(slug, canonicalName)
    .all();

  let tourDates: Record<string, unknown>[] = [];
  let jambase_attribution = false;

  const jbId =
    jambaseArtist && typeof jambaseArtist.identifier === 'string'
      ? jambaseArtist.identifier
      : null;

  if (apiKey?.trim() && jbId && artist?.id != null) {
    const eventsRes = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      apiKey,
      '/events',
      {
        artistId: jbId,
        eventDateFrom: jamBaseEventDateFromToday(),
        perPage: '50',
        page: '1',
      }
    );
    const events = eventsRes?.events ?? [];
    if (events.length) {
      const aid = Number(artist.id);
      tourDates = events.map((ev, i) => jamBaseEventToTourDateRow(ev, aid, i));
      jambase_attribution = true;
    }
  }

  if (tourDates.length === 0 && artist?.id != null) {
    const localTours = await db
      .prepare(
        `SELECT 
          artist_tour_dates.*,
          venues.name as venue_name,
          venues.location as venue_location
        FROM artist_tour_dates
        LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
        WHERE artist_tour_dates.artist_id = ?
        AND artist_tour_dates.date >= datetime('now')
        ORDER BY artist_tour_dates.date ASC`
      )
      .bind(artist.id)
      .all();
    tourDates = (localTours.results ?? []) as Record<string, unknown>[];
  }

  return {
    artist,
    clips: normalizeClipApiRows((clipsRes.results ?? []) as Record<string, unknown>[]),
    tourDates,
    jambase_attribution,
  };
}

export async function buildVenuePagePayload(c: Context): Promise<Record<string, unknown>> {
  const param = c.req.param('venueName') ?? '';
  const slug = normalizedSlugFromRouteParam(param);
  const apiKey = c.env.JAMBASE_API_KEY;
  const db = c.env.DB;

  let jambaseVenue: Record<string, unknown> | null = null;
  const phrase = searchPhraseFromSlug(slug);

  if (apiKey?.trim() && phrase) {
    const list = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(apiKey, '/venues', {
      venueName: phrase,
      perPage: '20',
      page: '1',
    });
    const venues = list?.venues ?? [];
    if (venues.length) {
      jambaseVenue =
        venues.find((v) => slugifyEntityName(String(v.name)) === slug) ?? venues[0];
    }
  }

  const canonicalName = jambaseVenue?.name
    ? String(jambaseVenue.name)
    : await resolveVenueNameForClipsQuery(db, apiKey, param);

  let venue = (await db
    .prepare(
      `SELECT * FROM venues WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ? OR name = ? LIMIT 1`
    )
    .bind(slug, canonicalName)
    .first()) as Record<string, unknown> | null;

  if (!venue) {
    const ins = await db
      .prepare(
        `INSERT INTO venues (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(canonicalName)
      .run();
    venue = (await db
      .prepare('SELECT * FROM venues WHERE id = ?')
      .bind(ins.meta.last_row_id)
      .first()) as Record<string, unknown> | null;
  }

  if (jambaseVenue && venue?.id != null) {
    const addr = jambaseVenue.address as Record<string, unknown> | undefined;
    const region = addr?.addressRegion as Record<string, unknown> | undefined;
    const locality =
      typeof addr?.addressLocality === 'string' ? addr.addressLocality : null;
    const regionName =
      typeof region?.alternateName === 'string'
        ? region.alternateName
        : typeof region?.name === 'string'
          ? (region.name as string)
          : null;
    const locationLine =
      [locality, regionName].filter(Boolean).join(', ') || null;
    const street =
      typeof addr?.streetAddress === 'string' ? addr.streetAddress : null;
    const cap =
      typeof jambaseVenue.maximumAttendeeCapacity === 'number'
        ? jambaseVenue.maximumAttendeeCapacity
        : null;
    const image =
      typeof jambaseVenue.image === 'string' && jambaseVenue.image.length > 0
        ? jambaseVenue.image
        : null;

    const updates: string[] = [];
    const binds: unknown[] = [];
    if (locationLine) {
      updates.push('location = ?');
      binds.push(locationLine);
    }
    if (street) {
      updates.push('address = ?');
      binds.push(street);
    }
    if (cap != null) {
      updates.push('capacity = ?');
      binds.push(cap);
    }
    if (image) {
      updates.push('image_url = ?');
      binds.push(image);
    }
    if (updates.length) {
      binds.push(venue.id);
      await db
        .prepare(
          `UPDATE venues SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind(...binds)
        .run();
      venue = (await db
        .prepare('SELECT * FROM venues WHERE id = ?')
        .bind(venue.id)
        .first()) as Record<string, unknown> | null;
    }
  }

  const clipsRes = await db
    .prepare(
      `SELECT 
        clips.rowid AS _clipRowId,
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.is_hidden = 0
      AND (
        LOWER(REPLACE(TRIM(IFNULL(clips.venue_name, '')), ' ', '-')) = ?
        OR clips.venue_name = ?
      )
      ORDER BY clips.created_at DESC
      LIMIT 50`
    )
    .bind(slug, canonicalName)
    .all();

  let upcomingEvents: Record<string, unknown>[] = [];
  let jambase_attribution = false;

  const vId =
    jambaseVenue && typeof jambaseVenue.identifier === 'string'
      ? jambaseVenue.identifier
      : null;

  if (apiKey?.trim() && vId && venue?.id != null) {
    const eventsRes = await jamBaseFetch<{ events?: Record<string, unknown>[] }>(
      apiKey,
      '/events',
      {
        venueId: vId,
        eventDateFrom: jamBaseEventDateFromToday(),
        perPage: '50',
        page: '1',
      }
    );
    const events = eventsRes?.events ?? [];
    if (events.length) {
      const vid = Number(venue.id);
      upcomingEvents = events.map((ev, i) => jamBaseEventToVenueUpcomingRow(ev, vid, i));
      jambase_attribution = true;
    }
  }

  if (upcomingEvents.length === 0 && venue?.id != null) {
    const local = await db
      .prepare(
        `SELECT 
          artist_tour_dates.*,
          artists.name as artist_name,
          artists.image_url as artist_image
        FROM artist_tour_dates
        LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
        WHERE artist_tour_dates.venue_id = ?
        AND artist_tour_dates.date >= datetime('now')
        ORDER BY artist_tour_dates.date ASC`
      )
      .bind(venue.id)
      .all();
    upcomingEvents = (local.results ?? []) as Record<string, unknown>[];
  }

  return {
    venue,
    clips: normalizeClipApiRows((clipsRes.results ?? []) as Record<string, unknown>[]),
    upcomingEvents,
    jambase_attribution,
  };
}
