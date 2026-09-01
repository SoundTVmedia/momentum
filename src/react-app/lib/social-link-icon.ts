import type { LucideIcon } from 'lucide-react';
import {
  AudioLines,
  Clapperboard,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Music,
  ShoppingBag,
  Twitter,
  Youtube,
} from 'lucide-react';

export function parseSocialLinksRecord(raw: unknown): Record<string, string> {
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

/** Display order for artist/venue social click-outs. */
export const SOCIAL_LINK_DISPLAY_ORDER = [
  'website',
  'instagram',
  'twitter',
  'x',
  'youtube',
  'facebook',
  'tiktok',
  'spotify',
  'bandcamp',
  'merch',
  'shop',
  'store',
] as const;

const SOCIAL_LINK_ICONS: Record<string, LucideIcon> = {
  website: Globe,
  homepage: Globe,
  instagram: Instagram,
  twitter: Twitter,
  x: Twitter,
  youtube: Youtube,
  facebook: Facebook,
  tiktok: Clapperboard,
  spotify: Music,
  bandcamp: AudioLines,
  merch: ShoppingBag,
  shop: ShoppingBag,
  store: ShoppingBag,
};

const SOCIAL_LINK_LABELS: Record<string, string> = {
  website: 'Official website',
  homepage: 'Official website',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  merch: 'Shop merch',
  shop: 'Shop',
  store: 'Store',
};

function normalizeSocialKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Collapse aliases so twitter/x and merch/shop/store only render once. */
function socialLinkDedupeKey(key: string): string {
  const k = normalizeSocialKey(key);
  if (k === 'x') return 'twitter';
  if (k === 'shop' || k === 'store') return 'merch';
  if (k === 'homepage') return 'website';
  return k;
}

export function socialLinkIcon(key: string): LucideIcon {
  return SOCIAL_LINK_ICONS[normalizeSocialKey(key)] ?? ExternalLink;
}

export function socialLinkLabel(key: string): string {
  const k = normalizeSocialKey(key);
  if (SOCIAL_LINK_LABELS[k]) return SOCIAL_LINK_LABELS[k];
  if (!k) return 'Link';
  return k.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export type SocialLinkEntry = {
  key: string;
  url: string;
  icon: LucideIcon;
  label: string;
};

export function socialLinkEntries(links: Record<string, string>): SocialLinkEntry[] {
  const seen = new Set<string>();
  const entries: SocialLinkEntry[] = [];

  const push = (key: string, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const dedupe = socialLinkDedupeKey(key);
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    entries.push({
      key,
      url: trimmed,
      icon: socialLinkIcon(key),
      label: socialLinkLabel(key),
    });
  };

  for (const key of SOCIAL_LINK_DISPLAY_ORDER) {
    const url = links[key];
    if (typeof url === 'string') push(key, url);
  }

  for (const [key, url] of Object.entries(links)) {
    if (typeof url !== 'string') continue;
    if (SOCIAL_LINK_DISPLAY_ORDER.includes(normalizeSocialKey(key) as (typeof SOCIAL_LINK_DISPLAY_ORDER)[number])) {
      continue;
    }
    push(key, url);
  }

  return entries;
}
