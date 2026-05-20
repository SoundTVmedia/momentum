import { describe, expect, it } from 'vitest';
import { youtubeRequestUnits } from './youtube-cache';

describe('youtubeRequestUnits', () => {
  it('charges 100 units for search', () => {
    expect(youtubeRequestUnits('/search', { type: 'channel' })).toBe(100);
  });

  it('charges 1 unit for other endpoints', () => {
    expect(youtubeRequestUnits('/videos', {})).toBe(1);
    expect(youtubeRequestUnits('/channels', {})).toBe(1);
    expect(youtubeRequestUnits('/playlistItems', {})).toBe(1);
  });
});
