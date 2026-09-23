import type { JamBaseEventRecord } from './jambase-events';
import { jamBaseEventImageUrl, jamBaseEventTicketUrl, jamBaseEventVenueCityLine, jamBaseEventVenueName } from './jambase-events';
import { slugifyEntityName } from './jambase-slug';

const FESTIVAL_TYPE_RE = /festival/i;
/** Matches "festival", "fest", "Summerfest", "Jazz Fest", etc. */
const FESTIVAL_NAME_RE = /fest(?:ival)?s?\b/i;
const FESTIVAL_BRAND_RE =
  /\b(?:lollapalooza|coachella|bonnaroo|gov(?:ernors)? ball|outside lands|burning man|sxsw|electric forest|rolling loud|ultra music|tomorrowland|glastonbury|acl|shaky knees)\b/i;
const LINEUP_FESTIVAL_MIN_PERFORMERS = 8;
const SLUG_CONTAINS_MIN = 6;
const CLUSTER_MAX_GAP_MS = 16 * 24 * 60 * 60 * 1000;

const TICKET_OR_DIRECTORY_HOST_FRAGMENTS = [
  'jambase.com',
  'ticketmaster.com',
  'livenation.com',
  'axs.com',
  'eventbrite.com',
  'seatgeek.com',
  'dice.fm',
  'stubhub.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'spotify.com',
  'bandsintown.com',
  'songkick.com',
];

export type FestivalLineupArtist = {
  name: string;
  image_url: string | null;
  jambase_id: string | null;
  is_headliner: boolean;
};

export type FestivalPageFestival = {
  name: string;
  slug: string;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  venue_name: string | null;
  city_line: string | null;
  ticket_url: string | null;
  website_url: string | null;
  jambase_event_id: string | null;
};

function eventTypeValue(ev: JamBaseEventRecord): string {
  const keys = ['@type', 'type', 'eventType', 'x-eventType', 'additionalType'];
  const parts: string[] = [];
  for (const key of keys) {
    const raw = ev[key];
    if (typeof raw === 'string' && raw.trim()) parts.push(raw);
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) parts.push(item);
      }
    }
  }
  return parts.join(' ');
}

export function jamBaseEventPerformerCount(ev: JamBaseEventRecord): number {
  return Array.isArray(ev.performer) ? ev.performer.length : 0;
}

export function isJamBaseFestivalEvent(ev: JamBaseEventRecord | null | undefined): boolean {
  if (!ev || typeof ev !== 'object') return false;
  if (FESTIVAL_TYPE_RE.test(eventTypeValue(ev))) return true;
  const name = typeof ev.name === 'string' ? ev.name : '';
  if (name && (FESTIVAL_NAME_RE.test(name) || FESTIVAL_BRAND_RE.test(name))) return true;
  return jamBaseEventPerformerCount(ev) >= LINEUP_FESTIVAL_MIN_PERFORMERS;
}

/** Slug used for `/festivals/:slug` — drops a trailing year so annual editions share a page. */
export function festivalCanonicalSlug(name: string | null | undefined): string {
  const slug = slugifyEntityName(name);
  return slug.replace(/-20\d{2}$/, '').replace(/-19\d{2}$/, '');
}

/** JamBase `name=` keyword queries — keep the year, then also try without it. */
export function festivalTitleSearchPhrases(raw: string): string[] {
  const phrase = raw.trim().replace(/\s+/g, ' ');
  if (!phrase) return [];
  const withoutYear = phrase.replace(/\s+(?:19|20)\d{2}$/i, '').trim();
  const out: string[] = [];
  for (const item of [phrase, withoutYear]) {
    if (!item) continue;
    if (out.some((existing) => existing.toLowerCase() === item.toLowerCase())) continue;
    out.push(item);
  }
  return out;
}

export function festivalPathSlugFromEvent(ev: JamBaseEventRecord): string {
  const name = typeof ev.name === 'string' ? ev.name : '';
  return festivalCanonicalSlug(name) || slugifyEntityName(name);
}

export function festivalSlugMatches(
  eventName: string | null | undefined,
  routeSlug: string | null | undefined,
): boolean {
  const route = festivalCanonicalSlug(routeSlug) || slugifyEntityName(routeSlug);
  const event = festivalCanonicalSlug(eventName) || slugifyEntityName(eventName);
  if (!route || !event) return false;
  if (route === event) return true;
  const shorter = route.length <= event.length ? route : event;
  const longer = route.length <= event.length ? event : route;
  if (shorter.length < SLUG_CONTAINS_MIN) return false;
  return longer.includes(shorter);
}

export function jamBaseEventLineup(ev: JamBaseEventRecord): FestivalLineupArtist[] {
  const perf = ev.performer;
  if (!Array.isArray(perf)) return [];
  const seen = new Set<string>();
  const out: FestivalLineupArtist[] = [];
  for (const item of perf) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) continue;
    const key = slugifyEntityName(name) || name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      image_url: typeof rec.image === 'string' && rec.image.trim() ? rec.image.trim() : null,
      jambase_id: typeof rec.identifier === 'string' && rec.identifier.trim() ? rec.identifier.trim() : null,
      is_headliner: rec['x-isHeadliner'] === true,
    });
  }
  out.sort((a, b) => Number(b.is_headliner) - Number(a.is_headliner) || a.name.localeCompare(b.name));
  return out;
}

export function mergeFestivalLineups(events: JamBaseEventRecord[]): FestivalLineupArtist[] {
  const byKey = new Map<string, FestivalLineupArtist>();
  for (const ev of events) {
    for (const artist of jamBaseEventLineup(ev)) {
      const key = slugifyEntityName(artist.name) || artist.name.toLowerCase();
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, artist);
        continue;
      }
      byKey.set(key, {
        ...prev,
        image_url: prev.image_url || artist.image_url,
        jambase_id: prev.jambase_id || artist.jambase_id,
        is_headliner: prev.is_headliner || artist.is_headliner,
      });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => Number(b.is_headliner) - Number(a.is_headliner) || a.name.localeCompare(b.name),
  );
}

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function urlFromLinkEntry(entry: unknown): string | null {
  if (typeof entry === 'string') return normalizeHttpUrl(entry);
  if (typeof entry !== 'object' || entry === null) return null;
  const rec = entry as Record<string, unknown>;
  if (typeof rec.url === 'string') return normalizeHttpUrl(rec.url);
  if (typeof rec.identifier === 'string' && rec.identifier.startsWith('http')) {
    return normalizeHttpUrl(rec.identifier);
  }
  return null;
}

function isOfficialFestivalWebsite(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !TICKET_OR_DIRECTORY_HOST_FRAGMENTS.some((frag) => host === frag || host.endsWith(`.${frag}`));
  } catch {
    return false;
  }
}

function collectLinkCandidates(record: Record<string, unknown> | undefined): string[] {
  if (!record) return [];
  const candidates: string[] = [];
  const sameAs = record.sameAs;
  if (Array.isArray(sameAs)) {
    for (const entry of sameAs) {
      const url = urlFromLinkEntry(entry);
      if (url) candidates.push(url);
    }
  }
  for (const key of ['website', 'x-officialWebsite', 'officialWebsite', 'officialUrl']) {
    const raw = record[key];
    if (typeof raw === 'string') {
      const url = normalizeHttpUrl(raw);
      if (url) candidates.push(url);
    }
  }
  if (typeof record.url === 'string') {
    const url = normalizeHttpUrl(record.url);
    if (url) candidates.push(url);
  }
  return candidates;
}

/** Official festival site — skips JamBase, ticketing, and social hosts. */
export function jamBaseEventOfficialWebsite(ev: JamBaseEventRecord): string | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  const official = [...collectLinkCandidates(ev), ...collectLinkCandidates(loc)].filter(
    isOfficialFestivalWebsite,
  );
  return official[0] ?? null;
}

function eventStartMs(ev: JamBaseEventRecord): number {
  const start = typeof ev.startDate === 'string' ? Date.parse(ev.startDate) : NaN;
  return Number.isFinite(start) ? start : Number.POSITIVE_INFINITY;
}

function eventEndIso(ev: JamBaseEventRecord): string | null {
  if (typeof ev.endDate === 'string' && ev.endDate.trim()) return ev.endDate;
  return typeof ev.startDate === 'string' ? ev.startDate : null;
}

export function groupFestivalEvents(events: JamBaseEventRecord[]): JamBaseEventRecord[][] {
  const festivals = events.filter((ev) => isJamBaseFestivalEvent(ev) || jamBaseEventPerformerCount(ev) >= 3);
  const used = new Set<number>();
  const groups: JamBaseEventRecord[][] = [];
  for (let i = 0; i < festivals.length; i++) {
    if (used.has(i)) continue;
    const seed = festivals[i];
    const seedSlug = festivalPathSlugFromEvent(seed);
    const seedVenue = slugifyEntityName(jamBaseEventVenueName(seed));
    const seedStart = eventStartMs(seed);
    const group = [seed];
    used.add(i);
    if (!seedSlug) {
      groups.push(group);
      continue;
    }
    for (let j = i + 1; j < festivals.length; j++) {
      if (used.has(j)) continue;
      const other = festivals[j];
      if (festivalPathSlugFromEvent(other) !== seedSlug) continue;
      const otherVenue = slugifyEntityName(jamBaseEventVenueName(other));
      if (seedVenue && otherVenue && seedVenue !== otherVenue) continue;
      const otherStart = eventStartMs(other);
      if (Number.isFinite(seedStart) && Number.isFinite(otherStart)) {
        if (Math.abs(otherStart - seedStart) > CLUSTER_MAX_GAP_MS) continue;
      }
      group.push(other);
      used.add(j);
    }
    groups.push(group);
  }
  return groups;
}

export function pickFestivalGroupForSlug(
  events: JamBaseEventRecord[],
  routeSlug: string,
  nowMs = Date.now(),
): JamBaseEventRecord[] {
  const groups = groupFestivalEvents(events).filter((group) =>
    group.some((ev) => festivalSlugMatches(typeof ev.name === 'string' ? ev.name : '', routeSlug)),
  );
  if (groups.length === 0) return [];

  const scored = groups.map((group) => {
    const starts = group.map(eventStartMs).filter((ms) => Number.isFinite(ms));
    const soonest = starts.length ? Math.min(...starts) : Number.POSITIVE_INFINITY;
    const upcomingBoost = soonest >= nowMs - 12 * 60 * 60 * 1000 ? 0 : Number.MAX_SAFE_INTEGER / 4;
    const lineup = mergeFestivalLineups(group).length;
    return { group, soonest: soonest + upcomingBoost, lineup };
  });
  scored.sort((a, b) => a.soonest - b.soonest || b.lineup - a.lineup);
  return scored[0]?.group ?? [];
}

export function formatFestivalDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  const startYmd = typeof startIso === 'string' ? startIso.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!startYmd) return '';
  const start = new Date(Date.UTC(Number(startYmd[1]), Number(startYmd[2]) - 1, Number(startYmd[3])));
  const monthDay = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endYmd = typeof endIso === 'string' ? endIso.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!endYmd || endYmd[0] === startYmd[0]) {
    return start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const end = new Date(Date.UTC(Number(endYmd[1]), Number(endYmd[2]) - 1, Number(endYmd[3])));
  if (startYmd[1] === endYmd[1] && startYmd[2] === endYmd[2]) {
    return `${monthDay(start)} – ${Number(endYmd[3])}, ${endYmd[1]}`;
  }
  if (startYmd[1] === endYmd[1]) {
    return `${monthDay(start)} – ${monthDay(end)}, ${endYmd[1]}`;
  }
  return `${monthDay(start)}, ${startYmd[1]} – ${monthDay(end)}, ${endYmd[1]}`;
}

function richestEvent(group: JamBaseEventRecord[]): JamBaseEventRecord {
  return [...group].sort(
    (a, b) => jamBaseEventPerformerCount(b) - jamBaseEventPerformerCount(a) || eventStartMs(a) - eventStartMs(b),
  )[0];
}

export function festivalPageFromEvents(group: JamBaseEventRecord[]): {
  festival: FestivalPageFestival;
  artists: FestivalLineupArtist[];
  eventIds: string[];
} | null {
  if (group.length === 0) return null;
  const primary = richestEvent(group);
  const name = typeof primary.name === 'string' && primary.name.trim() ? primary.name.trim() : 'Festival';
  const starts = group
    .map((ev) => (typeof ev.startDate === 'string' ? ev.startDate : null))
    .filter((v): v is string => Boolean(v))
    .sort();
  const ends = group
    .map(eventEndIso)
    .filter((v): v is string => Boolean(v))
    .sort();
  const eventIds = group
    .map((ev) => {
      const raw = ev.identifier;
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      if (typeof raw === 'number' && Number.isFinite(raw)) return `jambase:${raw}`;
      return '';
    })
    .filter(Boolean);
  const ticket =
    group.map((ev) => jamBaseEventTicketUrl(ev)).find((url) => url && !/jambase\.com/i.test(url)) ??
    jamBaseEventTicketUrl(primary);
  const website = group.map((ev) => jamBaseEventOfficialWebsite(ev)).find(Boolean) ?? null;

  return {
    festival: {
      name,
      slug: festivalPathSlugFromEvent(primary),
      image_url: jamBaseEventImageUrl(primary),
      start_date: starts[0] ?? null,
      end_date: ends[ends.length - 1] ?? starts[0] ?? null,
      venue_name: jamBaseEventVenueName(primary) === 'Venue TBA' ? null : jamBaseEventVenueName(primary),
      city_line: jamBaseEventVenueCityLine(primary) || null,
      ticket_url: ticket,
      website_url: website,
      jambase_event_id: typeof primary.identifier === 'string' ? primary.identifier : null,
    },
    artists: mergeFestivalLineups(group),
    eventIds,
  };
}

/** JamBase-shaped event so festival pages can reuse show-mark ("I'm going") buttons. */
export function festivalPageToJamBaseEvent(
  festival: FestivalPageFestival,
): Record<string, unknown> | null {
  const id = festival.jambase_event_id?.trim();
  if (!id) return null;

  const cityParts = (festival.city_line ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const locality = cityParts[0] || undefined;
  const region = cityParts.slice(1).join(', ') || undefined;

  return {
    identifier: id,
    name: festival.name,
    '@type': 'Festival',
    startDate: festival.start_date ?? undefined,
    endDate: festival.end_date ?? undefined,
    image: festival.image_url ?? undefined,
    location: {
      name: festival.venue_name ?? undefined,
      address:
        locality || region
          ? {
              addressLocality: locality,
              addressRegion: region ? { alternateName: region } : undefined,
            }
          : undefined,
    },
  };
}
