/** JamBase `sameAs.identifier` → `artists.social_links` JSON keys used by the SPA. */
const JAMBASE_URL_TYPE_TO_SOCIAL_KEY: Record<string, string> = {
  officialSite: 'website',
  officialWebsite: 'website',
  website: 'website',
  homepage: 'website',
  merch: 'merch',
  shop: 'merch',
  store: 'merch',
  bandcamp: 'merch',
  instagram: 'instagram',
  twitter: 'twitter',
  youtube: 'youtube',
  spotify: 'spotify',
};

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

function isJambaseHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'jambase.com' || host.endsWith('.jambase.com');
  } catch {
    return false;
  }
}

export function isJambaseArtistProfileUrl(url: string): boolean {
  if (!isJambaseHost(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.startsWith('/band/') || path.startsWith('/artist/');
  } catch {
    return false;
  }
}

function urlFromJamBaseSameAsEntry(entry: unknown): { type: string; url: string } | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const rec = entry as Record<string, unknown>;
  const type = typeof rec.identifier === 'string' ? rec.identifier.trim() : '';
  const url = typeof rec.url === 'string' ? normalizeHttpUrl(rec.url) : null;
  if (!type || !url) return null;
  return { type, url };
}

export function jamBaseArtistHasSameAs(
  artist: Record<string, unknown> | null | undefined,
): boolean {
  return Array.isArray(artist?.sameAs) && artist.sameAs.length > 0;
}

/** Official site + social URLs from JamBase `sameAs` (requires `expandArtistSameAs=true`). */
export function jamBaseArtistSocialLinks(artist: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const sameAs = artist.sameAs;
  if (Array.isArray(sameAs)) {
    for (const entry of sameAs) {
      const parsed = urlFromJamBaseSameAsEntry(entry);
      if (!parsed) continue;
      const key = JAMBASE_URL_TYPE_TO_SOCIAL_KEY[parsed.type];
      if (!key || out[key]) continue;
      if ((key === 'website' || key === 'merch') && isJambaseArtistProfileUrl(parsed.url)) continue;
      out[key] = parsed.url;
    }
  }

  if (!out.website && typeof artist.url === 'string') {
    const url = normalizeHttpUrl(artist.url);
    if (url && !isJambaseArtistProfileUrl(url)) out.website = url;
  }

  return out;
}

export function parseArtistSocialLinksJson(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      value = JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string' && entry.trim()) out[key] = entry.trim();
  }
  return out;
}

/** JamBase fills missing keys; replaces a JamBase profile URL mistakenly stored as `website`. */
export function mergeArtistSocialLinks(
  existing: Record<string, string>,
  fromJamBase: Record<string, string>,
): Record<string, string> {
  const merged = { ...existing };

  for (const [key, url] of Object.entries(fromJamBase)) {
    if (!url.trim()) continue;
    const current = merged[key]?.trim();
    if (!current) {
      merged[key] = url;
      continue;
    }
    if (key === 'website' && isJambaseArtistProfileUrl(current)) {
      merged[key] = url;
    }
  }

  return merged;
}

export function artistSocialLinksToJson(links: Record<string, string>): string | null {
  const filtered = Object.fromEntries(
    Object.entries(links).filter(([, v]) => typeof v === 'string' && v.trim()),
  );
  return Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : null;
}
