import { describe, expect, it } from 'vitest';
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
import {
  parseSocialLinksRecord,
  socialLinkEntries,
  socialLinkIcon,
  socialLinkLabel,
} from './social-link-icon';

describe('socialLinkIcon', () => {
  it('maps known platforms to distinct lucide icons', () => {
    expect(socialLinkIcon('website')).toBe(Globe);
    expect(socialLinkIcon('instagram')).toBe(Instagram);
    expect(socialLinkIcon('twitter')).toBe(Twitter);
    expect(socialLinkIcon('x')).toBe(Twitter);
    expect(socialLinkIcon('youtube')).toBe(Youtube);
    expect(socialLinkIcon('facebook')).toBe(Facebook);
    expect(socialLinkIcon('tiktok')).toBe(Clapperboard);
    expect(socialLinkIcon('spotify')).toBe(Music);
    expect(socialLinkIcon('bandcamp')).toBe(AudioLines);
    expect(socialLinkIcon('merch')).toBe(ShoppingBag);
    expect(socialLinkIcon('shop')).toBe(ShoppingBag);
  });

  it('falls back to ExternalLink for unknown keys', () => {
    expect(socialLinkIcon('soundcloud')).toBe(ExternalLink);
  });
});

describe('socialLinkLabel', () => {
  it('returns readable labels', () => {
    expect(socialLinkLabel('twitter')).toBe('X (Twitter)');
    expect(socialLinkLabel('website')).toBe('Official website');
    expect(socialLinkLabel('tiktok')).toBe('TikTok');
  });
});

describe('parseSocialLinksRecord', () => {
  it('parses JSON strings and objects', () => {
    expect(parseSocialLinksRecord('{"instagram":"https://ig.com/a"}')).toEqual({
      instagram: 'https://ig.com/a',
    });
    expect(parseSocialLinksRecord({ website: 'https://a.com', empty: '  ' })).toEqual({
      website: 'https://a.com',
    });
  });
});

describe('socialLinkEntries', () => {
  it('orders known keys and skips empty urls', () => {
    const entries = socialLinkEntries({
      merch: 'https://shop.example',
      instagram: 'https://instagram.com/a',
      website: 'https://example.com',
      twitter: '',
    });
    expect(entries.map((e) => e.key)).toEqual(['website', 'instagram', 'merch']);
  });

  it('dedupes twitter/x and merch/shop', () => {
    const entries = socialLinkEntries({
      twitter: 'https://x.com/a',
      x: 'https://x.com/b',
      merch: 'https://shop.example',
      shop: 'https://shop.example/alt',
    });
    expect(entries.map((e) => e.key)).toEqual(['twitter', 'merch']);
  });
});
