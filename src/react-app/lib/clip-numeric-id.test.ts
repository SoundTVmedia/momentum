import { describe, expect, it } from 'vitest';
import { clipFeedNavIndex, clipNumericId } from './clip-numeric-id';

describe('clipFeedNavIndex', () => {
  it('prefers the tapped list object when the same id appears twice', () => {
    const a = { id: 7, video_url: 'a' };
    const b = { id: 7, video_url: 'b' };
    expect(clipFeedNavIndex([a, b], b)).toBe(1);
    expect(clipNumericId(b)).toBe(7);
  });

  it('falls back to numeric id when the object is a copy', () => {
    const clips = [{ id: 3 }, { id: 9 }, { id: 12 }];
    expect(clipFeedNavIndex(clips, { id: 9 })).toBe(1);
  });
});
