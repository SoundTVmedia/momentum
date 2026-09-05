import { describe, expect, it } from 'vitest';
import { pickJamBaseArtistImage } from './jambase-artist-image';

describe('pickJamBaseArtistImage', () => {
  it('prefers an exact name match over the first search hit', () => {
    expect(
      pickJamBaseArtistImage('Phish', [
        { name: 'Phish Cover Band', image: 'https://example.com/cover.jpg' },
        { name: 'Phish', image: 'https://example.com/phish.jpg' },
      ]),
    ).toBe('https://example.com/phish.jpg');
  });

  it('falls back to the first hit when nothing matches exactly', () => {
    expect(
      pickJamBaseArtistImage('Unknown Act', [
        { name: 'Some Band', image: 'https://example.com/some.jpg' },
      ]),
    ).toBe('https://example.com/some.jpg');
  });
});
