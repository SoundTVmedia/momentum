import { describe, expect, it } from 'vitest';
import { ARCHIVAL_SHOW_ID_PREFIX, archivalShowDateKey, isArchivalShowId } from './archival-show';
import { favoriteEntityKey, isUserFavoriteType } from './user-favorites';

describe('archival show ids', () => {
  it('detects the archival prefix', () => {
    expect(isArchivalShowId(`${ARCHIVAL_SHOW_ID_PREFIX}abc`)).toBe(true);
    expect(isArchivalShowId('jambase:123')).toBe(false);
  });

  it('extracts a YYYY-MM-DD date prefix', () => {
    expect(archivalShowDateKey('2024-07-04T20:00:00-04:00')).toBe('2024-07-04');
    expect(archivalShowDateKey('not-a-date')).toBe('');
  });
});

describe('user favorite types', () => {
  it('accepts supported types and rejects songs-from-homepage-style unknowns', () => {
    expect(isUserFavoriteType('artist')).toBe(true);
    expect(isUserFavoriteType('venue')).toBe(true);
    expect(isUserFavoriteType('song')).toBe(true);
    expect(isUserFavoriteType('archival_show')).toBe(true);
    expect(isUserFavoriteType('show')).toBe(false);
  });

  it('normalizes song keys by collapsing spaces', () => {
    expect(favoriteEntityKey('song', 'Mr Brightside')).toBe('mr-brightside');
  });
});
