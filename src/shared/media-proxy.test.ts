import { describe, expect, it } from 'vitest';
import {
  base64UrlToUtf8,
  displayMediaUrl,
  encodeMediaProxyToken,
  isProxyableMediaHost,
  rewriteJamBaseEventImages,
  shouldProxyExternalMedia,
} from './media-proxy';

describe('media-proxy', () => {
  it('allowlists JamBase and Unsplash hosts', () => {
    expect(isProxyableMediaHost('www.jambase.com')).toBe(true);
    expect(isProxyableMediaHost('cdn.jambase.com')).toBe(true);
    expect(isProxyableMediaHost('images.unsplash.com')).toBe(true);
    expect(isProxyableMediaHost('evil.com')).toBe(false);
  });

  it('only proxies https allowlisted URLs', () => {
    expect(
      shouldProxyExternalMedia(
        'https://www.jambase.com/wp-content/uploads/2021/02/olivia.jpg',
      ),
    ).toBe(true);
    expect(shouldProxyExternalMedia('/api/files/thumb.jpg')).toBe(false);
    expect(shouldProxyExternalMedia('http://www.jambase.com/x.jpg')).toBe(false);
    expect(shouldProxyExternalMedia('https://example.com/x.jpg')).toBe(false);
    expect(
      shouldProxyExternalMedia(
        'https://app.example/api/media/proxy/b/abc',
      ),
    ).toBe(false);
  });

  it('round-trips base64url tokens', () => {
    const src = 'https://www.jambase.com/wp-content/uploads/a.jpg';
    const token = encodeMediaProxyToken(src);
    expect(base64UrlToUtf8(token)).toBe(src);
  });

  it('rewrites display URLs through the path-based proxy', () => {
    const src = 'https://www.jambase.com/wp-content/uploads/a.jpg';
    const out = displayMediaUrl(src, 'https://app.example');
    expect(out.startsWith('https://app.example/api/media/proxy/b/')).toBe(true);
    expect(displayMediaUrl('/api/files/x.jpg')).toBe('/api/files/x.jpg');
    expect(displayMediaUrl(null)).toBe('');
  });

  it('rewrites JamBase event image fields', () => {
    const rewritten = rewriteJamBaseEventImages(
      {
        image: 'https://www.jambase.com/a.jpg',
        location: { image: 'https://www.jambase.com/v.jpg' },
        performer: [{ image: 'https://www.jambase.com/p.jpg', name: 'A' }],
      },
      'https://app.example',
    );
    expect(String(rewritten.image)).toContain('/api/media/proxy/b/');
    expect(String((rewritten.location as { image: string }).image)).toContain(
      '/api/media/proxy/b/',
    );
    expect(
      String((rewritten.performer as { image: string }[])[0]?.image),
    ).toContain('/api/media/proxy/b/');
  });
});
