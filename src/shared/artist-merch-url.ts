/** Official shop / merch / website from `artists.social_links` JSON. */

function parseSocialLinks(raw: unknown): Record<string, string> {
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

function isJambaseHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === 'jambase.com' || host.endsWith('.jambase.com');
}

export function normalizeExternalHttpUrl(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (isJambaseHost(url)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Prefer a dedicated merch/shop link, then the artist website.
 * JamBase profile URLs are skipped — they are not a storefront.
 */
export function merchUrlFromArtistSocialLinks(raw: unknown): string | null {
  const links = parseSocialLinks(raw);
  return (
    normalizeExternalHttpUrl(links.merch) ??
    normalizeExternalHttpUrl(links.shop) ??
    normalizeExternalHttpUrl(links.store) ??
    normalizeExternalHttpUrl(links.bandcamp) ??
    normalizeExternalHttpUrl(links.website)
  );
}
