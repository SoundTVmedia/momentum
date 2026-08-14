import { describe, expect, it } from 'vitest';
import {
  isHudSongIdentifyPending,
  resolveCaptureHudSongLabel,
} from './capture-hud-song';

describe('resolveCaptureHudSongLabel', () => {
  it('prefers the identified title for the queued clip', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: 'Tweezer',
        liveMatch: { artist: 'Other', title: 'Other Song' },
        identifyPending: true,
      }),
    ).toBe('♪ Tweezer');
  });

  it('shows the stabilized live match while recording', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: { artist: 'Neil Young', title: 'Harvest Moon' },
        identifyPending: false,
      }),
    ).toBe('♪ Harvest Moon — Neil Young');
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: { artist: '', title: 'Harvest Moon' },
        identifyPending: false,
      }),
    ).toBe('♪ Harvest Moon');
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: { artist: 'Neil Young', title: '' },
        identifyPending: false,
      }),
    ).toBe('♪ Neil Young');
  });

  it('shows the pending state while song ID runs for the queued clip', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: null,
        identifyPending: true,
      }),
    ).toBe('Identifying song…');
  });

  it('is hidden with no song information', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: null,
        identifyPending: false,
      }),
    ).toBeNull();
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: '  ',
        liveMatch: { artist: ' ', title: '' },
        identifyPending: false,
      }),
    ).toBeNull();
  });
});

describe('isHudSongIdentifyPending', () => {
  it('is pending while the queued job has song ID outstanding', () => {
    expect(isHudSongIdentifyPending({ songIdentifyPending: true }, null)).toBe(true);
    expect(isHudSongIdentifyPending({}, null)).toBe(true);
  });

  it('is not pending once resolved, identified, or without a job', () => {
    expect(isHudSongIdentifyPending({ songIdentifyPending: false }, null)).toBe(false);
    expect(isHudSongIdentifyPending({ songIdentifyPending: true }, 'Tweezer')).toBe(false);
    expect(isHudSongIdentifyPending(null, null)).toBe(false);
  });
});
