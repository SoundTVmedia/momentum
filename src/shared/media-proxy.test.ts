import { describe, expect, it } from 'vitest';
import {
  displayMediaUrl,
  isProxyableMediaHost,
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
  });

  it('rewrites display URLs through the proxy path', () => {
    const src = 'https://www.jambase.com/wp-content/uploads/a.jpg';
    expect(displayMediaUrl(src)).toBe(
      `/api/media/proxy?url=${encodeURIComponent(src)}`,
    );
    expect(displayMediaUrl('/api/files/x.jpg')).toBe('/api/files/x.jpg');
    expect(displayMediaUrl(null)).toBe('');
  });
});
