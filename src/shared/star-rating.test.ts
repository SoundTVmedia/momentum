import { describe, expect, it } from 'vitest';
import { parseStarRating } from './star-rating';

describe('parseStarRating', () => {
  it('accepts whole stars from 1 to 5', () => {
    expect(parseStarRating(1)).toBe(1);
    expect(parseStarRating(5)).toBe(5);
    expect(parseStarRating('3')).toBe(3);
  });

  it('rejects empty, fractional, and out-of-range values', () => {
    expect(parseStarRating(null)).toBeNull();
    expect(parseStarRating(0)).toBeNull();
    expect(parseStarRating(6)).toBeNull();
    expect(parseStarRating(4.5)).toBeNull();
    expect(parseStarRating('star')).toBeNull();
  });
});
