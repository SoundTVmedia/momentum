import { describe, expect, it } from 'vitest';
import type { UserShowMark } from '@/shared/show-marks';
import { archivalUploadNavState } from './archival-upload';

function mark(overrides: Partial<UserShowMark> = {}): UserShowMark {
  return {
    id: 1,
    status: 'attended',
    jambase_event_id: 'jambase:123',
    jambase_venue_id: 'venue-1',
    jambase_artist_id: 'artist-1',
    event_title: 'Phish NYE',
    artist_name: 'Phish',
    venue_name: 'Madison Square Garden',
    venue_location: 'New York, NY',
    venue_timezone: 'America/New_York',
    start_date: '2024-12-31T01:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('archivalUploadNavState', () => {
  it('opens the library uploader with no show prefilled', () => {
    expect(archivalUploadNavState()).toEqual({ fromPhotoLibrary: true });
  });

  it('prefills the attended show for upload', () => {
    expect(archivalUploadNavState(mark())).toEqual({
      fromPhotoLibrary: true,
      showData: {
        jambase_event_id: 'jambase:123',
        jambase_venue_id: 'venue-1',
        jambase_artist_id: 'artist-1',
        event_title: 'Phish NYE',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        location: 'New York, NY',
        start_date: '2024-12-31T01:00:00.000Z',
      },
    });
  });
});
