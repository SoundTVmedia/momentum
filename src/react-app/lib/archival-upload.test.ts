import { describe, expect, it } from 'vitest';
import type { UserShowMark } from '@/shared/show-marks';
import {
  archivalShowDataFromEvent,
  archivalUploadNavState,
  clipUploadTargetFromShowData,
} from './archival-upload';

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

const jayZYankee = {
  identifier: 'jambase:jayz-yankee',
  name: 'Jay-Z at Yankee Stadium',
  startDate: '2024-07-14T20:00:00',
  performer: [
    { name: 'Jay-Z', identifier: 'jambase:jayz', 'x-isHeadliner': true },
  ],
  location: {
    name: 'Yankee Stadium',
    identifier: 'jambase:yankee',
    address: {
      addressLocality: 'Bronx',
      addressRegion: { alternateName: 'NY' },
    },
  },
};

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

  it('uses the show page event so the clip is tagged to that concert', () => {
    expect(archivalUploadNavState(mark(), jayZYankee)).toEqual({
      fromPhotoLibrary: true,
      showData: {
        jambase_event_id: 'jambase:jayz-yankee',
        jambase_venue_id: 'jambase:yankee',
        jambase_artist_id: 'jambase:jayz',
        event_title: 'Jay-Z at Yankee Stadium',
        artist_name: 'Jay-Z',
        venue_name: 'Yankee Stadium',
        location: 'Bronx, NY',
        start_date: '2024-07-14T20:00:00',
      },
    });
  });
});

describe('archivalShowDataFromEvent', () => {
  it('extracts Jay-Z at Yankee Stadium event fields', () => {
    expect(archivalShowDataFromEvent(jayZYankee)).toMatchObject({
      jambase_event_id: 'jambase:jayz-yankee',
      artist_name: 'Jay-Z',
      venue_name: 'Yankee Stadium',
      event_title: 'Jay-Z at Yankee Stadium',
    });
  });
});

describe('clipUploadTargetFromShowData', () => {
  it('stamps artist, venue, and event id onto the upload payload', () => {
    expect(
      clipUploadTargetFromShowData({
        jambase_event_id: 'jambase:jayz-yankee',
        jambase_artist_id: 'jambase:jayz',
        jambase_venue_id: 'jambase:yankee',
        event_title: 'Jay-Z at Yankee Stadium',
        artist_name: 'Jay-Z',
        venue_name: 'Yankee Stadium',
        location: 'Bronx, NY',
      }),
    ).toEqual({
      form: {
        artist_name: 'Jay-Z',
        venue_name: 'Yankee Stadium',
        location: 'Bronx, NY',
      },
      jambaseLink: {
        event: 'jambase:jayz-yankee',
        artist: 'jambase:jayz',
        venue: 'jambase:yankee',
        eventTitle: 'Jay-Z at Yankee Stadium',
      },
    });
  });
});
