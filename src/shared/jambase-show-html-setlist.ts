import type { JamBaseSetlistSong } from './jambase-setlist';
import { jamBaseEventArtistName, jamBaseEventVenueName } from './jambase-events';
import { slugifyEntityName } from './jambase-slug';

const SONG_NAME_RE = /<span class="[^"]*\bsong-name\b[^"]*"\s*>\s*([^<]+?)\s*<\/span>/gi;

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(Number.parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** JamBase concert page URL from a Data API event (`https://www.jambase.com/show/...`). */
function showUrlFromRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!/^(www\.)?jambase\.com$/i.test(parsed.hostname)) return null;
    if (!parsed.pathname.startsWith('/show/')) return null;
    parsed.hash = '';
    parsed.search = '';
    parsed.protocol = 'https:';
    parsed.hostname = 'www.jambase.com';
    return parsed.toString();
  } catch {
    return null;
  }
}

/** JamBase concert URLs look like `/show/phish-madison-square-garden-20260725`. */
function constructedShowPageUrl(ev: Record<string, unknown>): string | null {
  const artist = slugifyEntityName(jamBaseEventArtistName(ev));
  const venue = slugifyEntityName(jamBaseEventVenueName(ev));
  const start = typeof ev.startDate === 'string' ? ev.startDate.trim() : '';
  const ymd = start.slice(0, 10).replace(/-/g, '');
  if (!artist || !venue || venue === 'venue-tba' || ymd.length !== 8) return null;
  return `https://www.jambase.com/show/${artist}-${venue}-${ymd}`;
}

export function jamBaseShowPageUrl(ev: Record<string, unknown> | null | undefined): string | null {
  if (!ev) return null;
  const candidates: string[] = [];
  if (typeof ev.url === 'string') candidates.push(ev.url);
  const sameAs = ev.sameAs;
  if (Array.isArray(sameAs)) {
    for (const row of sameAs) {
      if (typeof row === 'string') candidates.push(row);
      else if (row && typeof row === 'object') {
        const url = (row as Record<string, unknown>).url;
        if (typeof url === 'string') candidates.push(url);
      }
    }
  }
  for (const candidate of candidates) {
    const url = showUrlFromRaw(candidate);
    if (url) return url;
  }
  return constructedShowPageUrl(ev);
}

/**
 * Songs published on a JamBase show page. The Data API event object does not
 * include this list; the HTML concert page does.
 */
export function parseJamBaseShowHtmlSetlist(html: string): JamBaseSetlistSong[] {
  if (!html) return [];
  const out: JamBaseSetlistSong[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(SONG_NAME_RE)) {
    const title = decodeHtmlEntities(match[1] ?? '');
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title });
  }
  return out;
}
