import { describe, expect, it } from 'vitest';
import { computeShowId, utcYmdFromTimestamp } from './show-id';

describe('show-id', () => {
  it('prefers jambase_event_id', () => {
    expect(
      computeShowId({
        jambase_event_id: 'jambase:12345',
        artist_name: 'Phish',
        venue_name: 'MSG',
        timestamp: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('jambase:12345');
  });

  it('builds composite slug from artist, venue, and UTC date', () => {
    expect(
      computeShowId({
        artist_name: 'Taylor Swift',
        venue_name: 'Madison Square Garden',
        timestamp: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('taylor-swift-madison-square-garden-2025-04-20');
  });

  it('returns null when required fields are missing', () => {
    expect(
      computeShowId({
        artist_name: 'Phish',
        venue_name: 'MSG',
      }),
    ).toBeNull();
    expect(computeShowId({ artist_name: 'Phish', timestamp: '2025-04-20T00:00:00.000Z' })).toBeNull();
  });

  it('parses UTC calendar day', () => {
    expect(utcYmdFromTimestamp('2025-04-20T23:59:59.000Z')).toBe('2025-04-20');
  });
});
