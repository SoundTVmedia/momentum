import {
  getVenueLogoFromCache,
  persistVenueLogoCache,
  websiteLogoCacheKey,
  type VenueLogoCacheSource,
} from './venue-logo-cache';

const FETCH_TIMEOUT_MS = 4500;
const MAX_HTML_BYTES = 96_000;

const NON_OFFICIAL_HOST_FRAGMENTS = [
  'jambase.com',
  'ticketmaster.com',
  'axs.com',
  'eventbrite.com',
  'seatgeek.com',
  'dice.fm',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'spotify.com',
  'musicbrainz.org',
  'bandsintown.com',
  'songkick.com',
];

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.2') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.')
    ) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

function isLikelyOfficialVenueWebsite(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !NON_OFFICIAL_HOST_FRAGMENTS.some((frag) => host === frag || host.endsWith(`.${frag}`));
  } catch {
    return false;
  }
}

function urlFromJamBaseLinkEntry(entry: unknown): string | null {
  if (typeof entry === 'string') return normalizeHttpUrl(entry);
  if (typeof entry !== 'object' || entry === null) return null;
  const rec = entry as Record<string, unknown>;
  if (typeof rec.url === 'string') return normalizeHttpUrl(rec.url);
  if (typeof rec.identifier === 'string' && rec.identifier.startsWith('http')) {
    return normalizeHttpUrl(rec.identifier);
  }
  return null;
}

/** Official venue site from JamBase `sameAs`, `url`, or related link fields (not JamBase/ticket/social). */
export function jamBaseVenueOfficialWebsite(venue: Record<string, unknown>): string | null {
  const candidates: string[] = [];

  const sameAs = venue.sameAs;
  if (Array.isArray(sameAs)) {
    for (const entry of sameAs) {
      const url = urlFromJamBaseLinkEntry(entry);
      if (url) candidates.push(url);
    }
  }

  for (const key of ['website', 'x-officialWebsite', 'officialWebsite', 'officialUrl']) {
    const raw = venue[key];
    if (typeof raw === 'string') {
      const url = normalizeHttpUrl(raw);
      if (url) candidates.push(url);
    }
  }

  const links = venue.links;
  if (Array.isArray(links)) {
    for (const entry of links) {
      const url = urlFromJamBaseLinkEntry(entry);
      if (url) candidates.push(url);
    }
  }

  if (typeof venue.url === 'string') {
    const url = normalizeHttpUrl(venue.url);
    if (url) candidates.push(url);
  }

  const official = candidates.filter(isLikelyOfficialVenueWebsite);
  if (official.length === 0) return null;

  official.sort((a, b) => {
    try {
      const aHost = new URL(a).hostname.split('.').length;
      const bHost = new URL(b).hostname.split('.').length;
      return aHost - bHost;
    } catch {
      return 0;
    }
  });

  return official[0] ?? null;
}

function resolveRelativeUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractIconLinks(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const linkRe =
    /<link\b[^>]*\brel=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  const linkReAlt =
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']([^"']+)["'][^>]*>/gi;

  const consider = (relRaw: string, hrefRaw: string) => {
    const rel = relRaw.toLowerCase();
    const href = hrefRaw.trim();
    if (!href || href.startsWith('data:')) return;
    const abs = resolveRelativeUrl(baseUrl, href);
    if (!abs) return;

    if (rel.includes('apple-touch-icon')) found.push(abs);
    else if (rel.includes('icon')) found.push(abs);
    else if (rel.includes('shortcut icon')) found.push(abs);
  };

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    consider(m[1], m[2]);
  }
  while ((m = linkReAlt.exec(html)) !== null) {
    consider(m[2], m[1]);
  }

  return found;
}

async function fetchHtmlHead(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'FeedbackVenueLogo/1.0',
      },
    });
    if (!res.ok) return null;
    const finalUrl = res.url || url;
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const html = new TextDecoder('utf-8').decode(slice);
    return { html, finalUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort logo URL from a venue's official website (apple-touch-icon, favicon, etc.). */
export async function resolveWebsiteLogoUrl(
  db: D1Database,
  websiteUrl: string,
): Promise<string | null> {
  const normalized = normalizeHttpUrl(websiteUrl);
  if (!normalized || !isLikelyOfficialVenueWebsite(normalized)) return null;

  const cacheKey = websiteLogoCacheKey(normalized);
  const cached = await getVenueLogoFromCache(db, [cacheKey]);
  if (cached !== undefined) return cached;

  let resolved: string | null = null;
  try {
    const page = await fetchHtmlHead(normalized);
    if (page) {
      const icons = extractIconLinks(page.html, page.finalUrl);
      resolved = icons[0] ?? null;
      if (!resolved) {
        const origin = new URL(page.finalUrl).origin;
        resolved =
          resolveRelativeUrl(origin, '/apple-touch-icon.png') ??
          resolveRelativeUrl(origin, '/apple-touch-icon-precomposed.png') ??
          resolveRelativeUrl(origin, '/favicon.ico');
      }
    }
  } catch (e) {
    console.warn('resolveWebsiteLogoUrl:', normalized, e);
  }

  const source: VenueLogoCacheSource = resolved ? 'website' : 'none';
  await persistVenueLogoCache(db, [
    {
      cacheKey,
      websiteUrl: normalized,
      logoUrl: resolved,
      source,
    },
  ]);

  return resolved;
}

export function jamBaseVenueJamBaseImage(venue: Record<string, unknown>): string | null {
  const image = venue.image;
  return typeof image === 'string' && image.trim() ? image.trim() : null;
}

export async function resolveVenueLogoFromOfficialWebsite(
  db: D1Database,
  venue: Record<string, unknown>,
): Promise<string | null> {
  const site = jamBaseVenueOfficialWebsite(venue);
  if (!site) return null;
  return resolveWebsiteLogoUrl(db, site);
}
