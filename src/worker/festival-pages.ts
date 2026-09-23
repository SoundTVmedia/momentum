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
  jamBaseEventIdentifier,
  dedupeJamBaseEvents,
  fetchJamBaseEventsByEventName,
  JAMBASE_ARCHIVE_LOOKBACK_DAYS,
} from './jambase-events-search';

function festivalSearchMatched(events: Record<string, unknown>[], phrase: string): boolean {
  const slug = slugifyEntityName(phrase);
  return events.some((ev) => {
    const name = typeof ev.name === 'string' ? ev.name : '';
    return festivalSlugMatches(name, slug) || isJamBaseFestivalEvent(ev);
  });
}

async function searchFestivalEvents(
  apiKey: string,
  quota: JamBaseQuotaContext | undefined,
  phrase: string,
): Promise<Record<string, unknown>[]> {
  // Name search must include past editions. The venue lookback is only today,
  // which drops festivals that already happened (Shaky Knees the week after).
  const fromDate = jamBaseEventDateFromDaysAgo(JAMBASE_ARCHIVE_LOOKBACK_DAYS);
  const phrases = festivalTitleSearchPhrases(phrase);
  let merged: Record<string, unknown>[] = [];

  for (const title of phrases) {
    const fests = await fetchJamBaseEventsByEventName(apiKey, title, quota, {
      eventType: 'festival',
      perPage: '50',
      eventDateFrom: fromDate,
      expandPastEvents: 'true',
    });
    merged = dedupeJamBaseEvents([...merged, ...fests]);
    if (festivalSearchMatched(merged, phrase)) break;
  }

  if (!festivalSearchMatched(merged, phrase)) {
    for (const title of phrases) {
      const titled = await fetchJamBaseEventsByEventName(apiKey, title, quota, {
        perPage: '50',
        eventDateFrom: fromDate,
        expandPastEvents: 'true',
      });
      merged = dedupeJamBaseEvents([...merged, ...titled]);
      if (festivalSearchMatched(merged, phrase)) break;
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

function lineupFromClipArtists(
  clips: Array<{ artist_name?: unknown }>,
): FestivalLineupArtist[] {
  const seen = new Set<string>();
  const artists: FestivalLineupArtist[] = [];
  for (const clip of clips) {
    const name = typeof clip.artist_name === 'string' ? clip.artist_name.trim() : '';
    const key = slugifyEntityName(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    artists.push({
      name,
      image_url: null,
      jambase_id: null,
      is_headliner: false,
    });
  }
  return artists.sort((a, b) => a.name.localeCompare(b.name));
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
  let fromFestivalCache = false;
  if (db && festivalListKey) {
    const cached = await lookupCachedEventList(db, festivalListKey);
    if (cached && cached.length > 0) {
      group = pickFestivalGroupForSlug(cached, slug);
      if (group.length === 0) {
        group = cached.filter((ev) =>
          festivalSlugMatches(typeof ev.name === 'string' ? ev.name : '', slug),
        );
      }
      if (group.length === 0) group = cached;
      fromFestivalCache = group.length > 0;
    }
  }

  if (group.length === 0 && apiKey?.trim() && phrase) {
    const events = await searchFestivalEvents(apiKey, jbQ, phrase);
    group = pickFestivalGroupForSlug(events, slug);
    if (group.length === 0) {
      group = events.filter((ev) =>
        festivalSlugMatches(typeof ev.name === 'string' ? ev.name : '', slug),
      );
    }
  }

  const needsLineup = group.length > 0 && mergeFestivalLineups(group).length === 0;
  if (group.length > 0 && apiKey?.trim() && (!fromFestivalCache || needsLineup)) {
    const targets = [...group]
      .sort((a, b) => jamBaseEventPerformerCount(b) - jamBaseEventPerformerCount(a))
      .filter((ev) => needsLineup || jamBaseEventPerformerCount(ev) === 0)
      .slice(0, 4);
    let hydrated = false;
    for (const ev of targets) {
      const id = jamBaseEventIdentifier(ev);
      if (!id) continue;
      const full = await fetchJamBaseEventById(apiKey, jbQ, id);
      if (!full || jamBaseEventPerformerCount(full) === 0) continue;
      group = [full, ...group.filter((existing) => jamBaseEventIdentifier(existing) !== id)];
      hydrated = true;
    }
    if (hydrated) fromFestivalCache = false;
  }

  if (!fromFestivalCache && db && festivalListKey && group.length > 0) {
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
  const clips = normalizeClipApiRows((clipsRes.results ?? []) as Record<string, unknown>[]);
  const lineup =
    artists.length > 0 ? artists : lineupFromClipArtists(clips as Array<{ artist_name?: unknown }>);
  if (!festival.jambase_event_id) {
    const fromClip = clips.find((clip) => {
      const eventId = typeof clip.jambase_event_id === 'string' ? clip.jambase_event_id.trim() : '';
      const showId = typeof clip.show_id === 'string' ? clip.show_id.trim() : '';
      return Boolean(eventId || showId);
    });
    const adopted =
      (typeof fromClip?.jambase_event_id === 'string' && fromClip.jambase_event_id.trim()) ||
      (typeof fromClip?.show_id === 'string' && fromClip.show_id.trim()) ||
      '';
    if (adopted) festival.jambase_event_id = adopted;
  }
  if (!festival.start_date) {
    const clipDates = clips
      .map((clip) => (typeof clip.timestamp === 'string' ? clip.timestamp.trim() : ''))
      .filter(Boolean)
      .sort();
    if (clipDates[0]) festival.start_date = clipDates[0];
    if (!festival.end_date && clipDates.length > 1) {
      festival.end_date = clipDates[clipDates.length - 1] ?? null;
    }
  }

  return {
    festival,
    artists: lineup,
    clips,
    jambase_attribution: Boolean(built),
  };
}
