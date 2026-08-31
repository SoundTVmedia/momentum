import { describe, expect, it } from 'vitest';
import { merchUrlFromArtistSocialLinks, normalizeExternalHttpUrl } from './artist-merch-url';

describe('normalizeExternalHttpUrl', () => {
  it('adds https when the protocol is missing', () => {
    expect(normalizeExternalHttpUrl('shop.phish.com')).toBe('https://shop.phish.com/');
  });

  it('rejects JamBase hosts', () => {
    expect(normalizeExternalHttpUrl('https://www.jambase.com/band/phish')).toBeNull();
  });
});

describe('merchUrlFromArtistSocialLinks', () => {
  it('prefers merch over website', () => {
    expect(
      merchUrlFromArtistSocialLinks(
        JSON.stringify({ website: 'https://phish.com', merch: 'https://shop.phish.com' }),
      ),
    ).toBe('https://shop.phish.com/');
  });

  it('falls back to website when merch is missing', () => {
    expect(merchUrlFromArtistSocialLinks({ website: 'https://radiohead.com' })).toBe(
      'https://radiohead.com/',
    );
  });

  it('uses bandcamp when merch and website shop keys are missing', () => {
    expect(merchUrlFromArtistSocialLinks({ bandcamp: 'https://radiohead.bandcamp.com' })).toBe(
      'https://radiohead.bandcamp.com/',
    );
  });

  it('returns null for JamBase-only websites', () => {
    expect(
      merchUrlFromArtistSocialLinks({ website: 'https://www.jambase.com/band/phish' }),
    ).toBeNull();
  });
});
