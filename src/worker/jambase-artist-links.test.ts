import { describe, expect, it } from 'vitest';
import {
  artistSocialLinksToJson,
  isJambaseArtistProfileUrl,
  jamBaseArtistSocialLinks,
  mergeArtistSocialLinks,
  parseArtistSocialLinksJson,
} from './jambase-artist-links';

describe('jamBaseArtistSocialLinks', () => {
  it('maps sameAs entries to social_links keys', () => {
    expect(
      jamBaseArtistSocialLinks({
        sameAs: [
          { identifier: 'officialSite', url: 'https://www.noahkahanmusic.com' },
          { identifier: 'instagram', url: 'https://instagram.com/noahkahan' },
          { identifier: 'spotify', url: 'https://open.spotify.com/artist/abc' },
        ],
      }),
    ).toEqual({
      website: 'https://www.noahkahanmusic.com/',
      instagram: 'https://instagram.com/noahkahan',
      spotify: 'https://open.spotify.com/artist/abc',
    });
  });

  it('maps bandcamp and merch identifiers to merch', () => {
    expect(
      jamBaseArtistSocialLinks({
        sameAs: [{ identifier: 'bandcamp', url: 'https://phish.bandcamp.com' }],
      }),
    ).toEqual({ merch: 'https://phish.bandcamp.com/' });
  });

  it('falls back to artist.url when sameAs is missing', () => {
    expect(jamBaseArtistSocialLinks({ url: 'https://www.phish.com' })).toEqual({
      website: 'https://www.phish.com/',
    });
  });

  it('skips JamBase profile URLs tagged as officialSite', () => {
    expect(
      jamBaseArtistSocialLinks({
        sameAs: [{ identifier: 'officialSite', url: 'https://www.jambase.com/band/noah-kahan' }],
      }),
    ).toEqual({});
  });
});

describe('mergeArtistSocialLinks', () => {
  it('fills missing keys from JamBase', () => {
    expect(
      mergeArtistSocialLinks({ instagram: 'https://instagram.com/existing' }, { website: 'https://artist.com' }),
    ).toEqual({
      instagram: 'https://instagram.com/existing',
      website: 'https://artist.com',
    });
  });

  it('replaces JamBase profile stored as website', () => {
    expect(
      mergeArtistSocialLinks(
        { website: 'https://www.jambase.com/band/noah-kahan' },
        { website: 'https://www.noahkahanmusic.com' },
      ),
    ).toEqual({
      website: 'https://www.noahkahanmusic.com',
    });
  });

  it('does not overwrite curated website', () => {
    expect(
      mergeArtistSocialLinks(
        { website: 'https://custom-artist-site.com' },
        { website: 'https://www.noahkahanmusic.com' },
      ),
    ).toEqual({
      website: 'https://custom-artist-site.com',
    });
  });
});

describe('parseArtistSocialLinksJson', () => {
  it('parses stored JSON', () => {
    expect(parseArtistSocialLinksJson(JSON.stringify({ website: 'https://a.com', merch: 'https://shop.com' }))).toEqual({
      website: 'https://a.com',
      merch: 'https://shop.com',
    });
  });

  it('accepts an already-parsed object from D1', () => {
    expect(parseArtistSocialLinksJson({ website: 'https://phish.com', instagram: 'https://ig.com/phish' })).toEqual({
      website: 'https://phish.com',
      instagram: 'https://ig.com/phish',
    });
  });
});

describe('isJambaseArtistProfileUrl', () => {
  it('detects band profile URLs', () => {
    expect(isJambaseArtistProfileUrl('https://www.jambase.com/band/phish')).toBe(true);
    expect(isJambaseArtistProfileUrl('https://www.noahkahanmusic.com')).toBe(false);
  });
});

describe('artistSocialLinksToJson', () => {
  it('returns null for empty object', () => {
    expect(artistSocialLinksToJson({})).toBeNull();
  });
});
