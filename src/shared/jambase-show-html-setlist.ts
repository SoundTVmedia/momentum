import type { JamBaseSetlistSong } from './jambase-setlist';

const SONG_NAME_RE = /<span class="song-name">\s*([^<]+?)\s*<\/span>/gi;

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
export function jamBaseShowPageUrl(ev: Record<string, unknown> | null | undefined): string | null {
  if (!ev) return null;
  const raw = typeof ev.url === 'string' ? ev.url.trim() : '';
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
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
