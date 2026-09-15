import { describe, expect, it } from 'vitest';
import { normalizeShowRatingId } from './show-rating-endpoints';

describe('normalizeShowRatingId', () => {
  it('trims and decodes a show id from the URL', () => {
    expect(normalizeShowRatingId('jambase%3A123')).toBe('jambase:123');
    expect(normalizeShowRatingId('  phish-msg-2024  ')).toBe('phish-msg-2024');
  });

  it('returns empty for missing ids', () => {
    expect(normalizeShowRatingId(undefined)).toBe('');
    expect(normalizeShowRatingId('')).toBe('');
  });
});
