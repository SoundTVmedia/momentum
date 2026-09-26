import { describe, expect, it } from 'vitest';
import { queryLooksLikePlace } from './search-geo';

describe('queryLooksLikePlace', () => {
  it('treats states and city-region text as places', () => {
    expect(queryLooksLikePlace('Texas')).toBe(true);
    expect(queryLooksLikePlace('new york')).toBe(true);
    expect(queryLooksLikePlace('Austin, TX')).toBe(true);
    expect(queryLooksLikePlace('London, UK')).toBe(true);
  });

  it('does not geocode artist or song queries', () => {
    expect(queryLooksLikePlace('Radiohead')).toBe(false);
    expect(queryLooksLikePlace('Billie Eilish')).toBe(false);
    expect(queryLooksLikePlace('yellow')).toBe(false);
  });
});
