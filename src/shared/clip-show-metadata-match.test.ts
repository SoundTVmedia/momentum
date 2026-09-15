import { describe, expect, it } from 'vitest';
import {
  CLIP_SHOW_METADATA_MESSAGES,
  clipMetadataMatchesShow,
} from './clip-show-metadata-match';

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

  it('rejects a clip with no capture timestamp', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: null,
      artistName: 'Phish',
      venueName: 'Madison Square Garden',
    });
    expect(match.ok).toBe(false);
    if (!match.ok) {
      expect(match.reason).toBe('missing_timestamp');
      expect(match.message).toBe(CLIP_SHOW_METADATA_MESSAGES.missing_timestamp);
    }
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

  it('rejects a mismatched artist tag', () => {
    const match = clipMetadataMatchesShow({
      event: phishMsg,
      recordedAtIso: '2024-07-15T01:30:00.000Z',
      artistName: 'Goose',
      venueName: 'Madison Square Garden',
    });
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.reason).toBe('artist_mismatch');
  });
});
