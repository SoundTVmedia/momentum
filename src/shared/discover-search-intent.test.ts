import { describe, expect, it } from 'vitest';
import {
  discoverResultsAreVenueIntent,
  discoverSearchIsVenueIntent,
  searchQueryTargetsName,
} from './discover-search-intent';

describe('searchQueryTargetsName', () => {
  it('matches a full venue name', () => {
    expect(searchQueryTargetsName('Madison Square Garden', 'Madison Square Garden')).toBe(true);
    expect(searchQueryTargetsName('madison square', 'Madison Square Garden')).toBe(true);
  });

  it('does not treat a weak substring as a venue ask', () => {
    expect(searchQueryTargetsName('Garden', 'Madison Square Garden')).toBe(false);
    expect(searchQueryTargetsName('Phish', 'Madison Square Garden')).toBe(false);
    expect(searchQueryTargetsName('the', 'The Fillmore Charlotte')).toBe(false);
    expect(searchQueryTargetsName('Madison Square Garden', 'Madison Square Gardeners')).toBe(
      false,
    );
  });

  it('matches a single-token name only when the name is that token', () => {
    expect(searchQueryTargetsName('Fillmore', 'Fillmore')).toBe(true);
    expect(searchQueryTargetsName('Fillmore', 'The Fillmore Charlotte')).toBe(false);
  });
});

describe('discoverSearchIsVenueIntent', () => {
  it('is true when the query names a venue and not an artist or song', () => {
    expect(
      discoverSearchIsVenueIntent('Madison Square Garden', {
        venues: ['Madison Square Garden', 'Barclays Center'],
        artists: ['Phish', 'Madison Square Gardeners'],
        songs: ['Tweezer'],
      }),
    ).toBe(true);
  });

  it('is false for artist searches even if venues appear in results', () => {
    expect(
      discoverSearchIsVenueIntent('Phish', {
        venues: ['Madison Square Garden'],
        artists: ['Phish'],
        songs: [],
      }),
    ).toBe(false);
  });

  it('is false for song searches', () => {
    expect(
      discoverSearchIsVenueIntent('Tweezer', {
        venues: ['Madison Square Garden'],
        artists: ['Phish'],
        songs: ['Tweezer'],
      }),
    ).toBe(false);
  });

  it('is false for city or weak venue substrings', () => {
    expect(
      discoverSearchIsVenueIntent('Boston', {
        venues: ['Madison Square Garden', 'TD Garden'],
        artists: [],
        songs: [],
      }),
    ).toBe(false);
  });
});

describe('discoverResultsAreVenueIntent', () => {
  it('uses JamBase venue names from search results', () => {
    expect(
      discoverResultsAreVenueIntent('Madison Square Garden', {
        venues: [],
        artists: [{ name: 'Phish' }],
        songs: [],
        jambase: { venues: [{ name: 'Madison Square Garden' }] },
      }),
    ).toBe(true);
  });
});
