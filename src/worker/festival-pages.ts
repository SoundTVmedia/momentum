import type { Context } from 'hono';
import { PUBLIC_VISIBLE_CLIP_SQL } from '../shared/content-feed';
import {
  festivalPageFromEvents,
  festivalSlugMatches,
  festivalTitleSearchPhrases,
  isJamBaseFestivalEvent,
  jamBaseEventPerformerCount,
  mergeFestivalLineups,
  pickFestivalGroupForSlug,
  type FestivalLineupArtist,
} from '../shared/jambase-festival';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
  titleCaseWords,
} from '../shared/jambase-slug';
import { jamBaseVenueEventLookbackDateFrom } from '../shared/jambase-event-day';
import { rewriteJamBaseEventImages, rewriteMediaUrlForClient } from '../shared/media-proxy';
import { clientMediaOrigin } from './client-media-origin';
import { normalizeClipApiRows } from './clip-row-normalize';
import {
  jamBaseFestivalPageListKey,
  lookupCachedEventList,
  storeCachedEventList,
} from './jambase-cache';
import {
  jamBaseEventDateFromDaysAgo,
  jamBaseQuotaFromEnv,
  type JamBaseQuotaContext,
} from './jambase-client';
import {
  fetchJamBaseEventById,
  fetchJamBaseEventsByArtistName,
  fetchJamBaseEventsByVenueName,
} from './jambase-endpoints';
import {
  JAMBASE_ARCHIVE_LOOKBACK_DAYS,
  jamBaseEventIdentifier,
  dedupeJamBaseEvents,
  fetchJamBaseEventsByEventName,
} from './jambase-events-search';

async function searchFestivalTitle(
  apiKey: string,
  quota: JamBaseQuotaContext | undefined,
  title: string,
  eventType?: 'festival',
): Promise<Record<string, unknown>[]> {
  const upcomingFrom = jamBaseVenueEventLookbackDateFrom();
  const archiveFrom = jamBaseEventDateFromDaysAgo(JAMBASE_ARCHIVE_LOOKBACK_DAYS);
  const [upcoming, past] = await Promise.all([
    fetchJamBaseEventsByEventName(apiKey, title, quota, {
      eventType,
      perPage: '50',
      eventDateFrom: upcomingFrom,
    }),
    fetchJamBaseEventsByEventName(apiKey, title, quota, {
      eventType,
      perPage: '50',
      eventDateFrom: archiveFrom,
      expandPastEvents: 'true',
    }),
  ]);
  return dedupeJamBaseEvents([...upcoming, ...past]);
}

async function searchFestivalEvents(
  apiKey: string,
  quota: JamBaseQuotaContext | undefined,
  phrase: string,
): Promise<Record<string, unknown>[]> {
  const phrases = festivalTitleSearchPhrases(phrase);
  let merged: Record<string, unknown>[] = [];

  for (const title of phrases) {
    merged = dedupeJamBaseEvents([
      ...merged,
      ...(await searchFestivalTitle(apiKey, quota, title, 'festival')),
    ]);
    if (merged.length > 0) break;
  }

  if (merged.length === 0) {
    for (const title of phrases) {
      merged = dedupeJamBaseEvents([
        ...merged,
        ...(await searchFestivalTitle(apiKey, quota, title)),
      ]);
      if (merged.length > 0) break;
    }
  }

  const slugHits = merged.filter((ev) =>
    festivalSlugMatches(typeof ev.name === 'string' ? ev.name : '', slugifyEntityName(phrase)),
  );
  const festivalHits = merged.filter(isJamBaseFestivalEvent);
  if (slugHits.length + festivalHits.length >= 1) {
    return dedupeJamBaseEvents(merged);
  }

  const [byArtist, byVenue] = await Promise.all([
    fetchJamBaseEventsByArtistName(apiKey, quota, phrase, '50'),
    fetchJamBaseEventsByVenueName(apiKey, quota, phrase, '50'),
  ]);
  merged = dedupeJamBaseEvents([...merged, ...byArtist.events, ...byVenue.events]);
  return merged;
}

function pickFestivalEdition(
  events: Record<string, unknown>[],
  slug: string,
): Record<string, unknown>[] {
  let group = pickFestivalGroupForSlug(events, slug);
  if (group.length === 0) {
    group = events.filter((ev) =>
      festivalSlugMatches(typeof ev.name === 'string' ? ev.name : '', slug),
    );
  }
  return group.length > 0 ? group : events;
}

function rewriteLineup(
  artists: FestivalLineupArtist[],
  origin: string,
): FestivalLineupArtist[] {
  return artists.map((artist) => ({
    ...artist,
    image_url: rewriteMediaUrlForClient(artist.image_url, origin) ?? artist.image_url,
  }));
}

export async function buildFestivalPagePayload(c: Context): Promise<Record<string, unknown>> {
  const param = (c.req.param('festivalName') ?? '').trim();
  let slug = normalizedSlugFromRouteParam(param);
  if (!slug && param) slug = slugifyEntityName(param);
  const phrase = searchPhraseFromSlug(slug);
  const displayName = titleCaseWords(phrase) || param || 'Festival';
  const apiKey = c.env.JAMBASE_API_KEY;
  const db = c.env.DB;
  const jbQ = jamBaseQuotaFromEnv(c.env);
  const mediaOrigin = clientMediaOrigin(c);
  const festivalListKey = jamBaseFestivalPageListKey(slug);

  let group: Record<string, unknown>[] = [];
  const fresh =
    db && festivalListKey ? await lookupCachedEventList(db, festivalListKey) : null;
  const freshGroup = fresh && fresh.length > 0 ? pickFestivalEdition(fresh, slug) : [];
  const freshLineup = mergeFestivalLineups(freshGroup).length;
  let cached = fresh;

  if (freshLineup > 0) {
    group = freshGroup;
  } else if (apiKey?.trim() && phrase) {
    cached =
      fresh ??
      (db && festivalListKey
        ? await lookupCachedEventList(db, festivalListKey, { allowStale: true })
        : null);
    const events = await searchFestivalEvents(apiKey, jbQ, phrase);
    group = pickFestivalEdition(dedupeJamBaseEvents([...(cached ?? []), ...events]), slug);
  } else if (freshGroup.length > 0) {
    group = freshGroup;
  }

  if (group.length > 0 && mergeFestivalLineups(group).length === 0 && apiKey?.trim()) {
    const richest = [...group].sort(
      (a, b) => jamBaseEventPerformerCount(b) - jamBaseEventPerformerCount(a),
    )[0];
    const id = jamBaseEventIdentifier(richest ?? {});
    if (id) {
      const full = await fetchJamBaseEventById(apiKey, jbQ, id);
      if (full && jamBaseEventPerformerCount(full) > 0) {
        group = [full, ...group.filter((ev) => jamBaseEventIdentifier(ev) !== id)];
      }
    }
  }

  const cachedLineup =
    cached && cached.length > 0 ? mergeFestivalLineups(pickFestivalEdition(cached, slug)).length : 0;
  if (
    db &&
    festivalListKey &&
    mergeFestivalLineups(group).length > cachedLineup
  ) {
    await storeCachedEventList(db, festivalListKey, group);
  }

  const rewrittenGroup = group.map((ev) => rewriteJamBaseEventImages(ev, mediaOrigin));
  const built = festivalPageFromEvents(rewrittenGroup);

  const festival = built?.festival ?? {
    name: displayName,
    slug,
    image_url: null,
    start_date: null,
    end_date: null,
    venue_name: null,
    city_line: null,
    ticket_url: null,
    website_url: null,
    jambase_event_id: null,
  };

  if (festival.image_url) {
    festival.image_url = rewriteMediaUrlForClient(festival.image_url, mediaOrigin) ?? festival.image_url;
  }

  const artists = rewriteLineup(built?.artists ?? [], mediaOrigin);
  const eventIds = (built?.eventIds ?? []).slice(0, 20);
  const titleLike = `%${festival.name}%`;

  let clipsSql = `
    SELECT
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE ${PUBLIC_VISIBLE_CLIP_SQL}
    AND (
      clips.event_title LIKE ?
      OR LOWER(REPLACE(TRIM(IFNULL(clips.event_title, '')), ' ', '-')) LIKE ?
      ${eventIds.length > 0 ? `OR clips.jambase_event_id IN (${eventIds.map(() => '?').join(', ')})` : ''}
    )
  `;
  const bindings: unknown[] = [titleLike, `%${slug}%`];
  if (eventIds.length > 0) {
    bindings.push(...eventIds);
  }
  clipsSql += ` ORDER BY clips.created_at DESC LIMIT 50`;

  const clipsRes = await db.prepare(clipsSql).bind(...bindings).all();

  return {
    festival,
    artists,
    clips: normalizeClipApiRows((clipsRes.results ?? []) as Record<string, unknown>[]),
    jambase_attribution: Boolean(built),
  };
}
