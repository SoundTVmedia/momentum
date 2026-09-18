import { describe, expect, it } from 'vitest';
import { clipMetadataMatchesShow, clipShowTagsFromMatchedEvent } from './clip-show-metadata-match';

const phishMsg = {
  identifier: 'jambase:msg',
  startDate: '2024-07-14T20:00:00',
  performer: [{ name: 'Phish', 'x-isHeadliner': true }],
  location: {
    name: 'Madison Square Garden',
    geo: { latitude: 40.7505, longitude: -73.9934 },
    address: { 'x-timezone': 'America/New_York' },
  },
};

describe('clipMetadataMatchesShow', () => {
  it('accepts a clip recorded at the venue on show night', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: '2024-07-15T01:30:00.000Z',
      latitude: 40.7505,
      longitude: -73.9934,
      artistName: 'Phish',
      venueName: 'Madison Square Garden',
    });
    expect(match).toEqual({ ok: true });
  });

  it('accepts a past-show clip with no capture metadata when the user chose the show', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: null,
      artistName: 'Phish',
      venueName: 'Madison Square Garden',
    });
    expect(match).toEqual({ ok: true });
  });

  it('rejects a clip from a different night', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: '2024-07-10T01:30:00.000Z',
      artistName: 'Phish',
      venueName: 'Madison Square Garden',
    });
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.reason).toBe('date_mismatch');
  });

  it('rejects GPS far from the venue even when capture date is missing', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: null,
      latitude: 34.05,
      longitude: -118.25,
      artistName: 'Phish',
      venueName: 'Madison Square Garden',
    });
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.reason).toBe('location_mismatch');
  });

  it('rejects GPS far from the venue', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: '2024-07-15T01:30:00.000Z',
      latitude: 34.05,
      longitude: -118.25,
      artistName: 'Phish',
      venueName: 'Madison Square Garden',
    });
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.reason).toBe('location_mismatch');
  });

  it('matches a guest-artist song to the concert from location, event, and date', () => {
    const jayZYankee = {
      identifier: 'jambase:jayz-yankee',
      startDate: '2024-07-14T20:00:00',
      performer: [{ name: 'Jay-Z', 'x-isHeadliner': true }],
      location: {
        name: 'Yankee Stadium',
        geo: { latitude: 40.8296, longitude: -73.9262 },
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    const match = clipMetadataMatchesShow({
      event: jayZYankee,
      recordedAtIso: '2024-07-15T01:30:00.000Z',
      latitude: 40.8296,
      longitude: -73.9262,
      artistName: 'Rihanna',
      venueName: 'Yankee Stadium',
    });
    expect(match).toEqual({ ok: true });
  });

  it('still rejects a mismatched venue tag', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: '2024-07-15T01:30:00.000Z',
      artistName: 'Phish',
      venueName: 'Barclays Center',
    });
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.reason).toBe('venue_mismatch');
  });
});

describe('clipShowTagsFromMatchedEvent', () => {
  it('uses the concert headliner, not a guest song artist', () => {
    const tags = clipShowTagsFromMatchedEvent({
      identifier: 'jambase:jayz-yankee',
      name: 'Jay-Z at Yankee Stadium',
      startDate: '2024-07-14T20:00:00',
      performer: [
        { name: 'Jay-Z', identifier: 'jambase:jayz', 'x-isHeadliner': true },
        { name: 'Rihanna', identifier: 'jambase:rihanna' },
      ],
      location: { name: 'Yankee Stadium', identifier: 'jambase:yankee' },
    });
    expect(tags.artistName).toBe('Jay-Z');
    expect(tags.artistId).toBe('jambase:jayz');
    expect(tags.venueName).toBe('Yankee Stadium');
    expect(tags.venueId).toBe('jambase:yankee');
  });
});
