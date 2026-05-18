import { describe, expect, it } from 'vitest';
import { parseRangeHeader } from './r2-serve';

describe('parseRangeHeader', () => {
  it('parses bytes=start-end', () => {
    expect(parseRangeHeader('bytes=0-1023', 5000)).toEqual({ offset: 0, length: 1024 });
  });

  it('parses suffix range', () => {
    expect(parseRangeHeader('bytes=-500', 10_000)).toEqual({ offset: 9500, length: 500 });
  });

  it('returns unsatisfiable when start past EOF', () => {
    expect(parseRangeHeader('bytes=9000-', 100)).toBe('unsatisfiable');
  });
});
