import { describe, expect, it } from 'vitest';
import {
  isHudSongIdentifyPending,
  resolveCaptureHudSongLabel,
} from './capture-hud-song';

describe('resolveCaptureHudSongLabel', () => {
  it('prefers an identified title', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: 'Tweezer',
        liveMatch: { artist: 'Phish', title: 'Possum' },
        identifyPending: true,
      }),
    ).toBe('♪ Tweezer');
  });

  it('shows live title and artist while recording', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: { artist: 'Phish', title: 'Tweezer' },
        identifyPending: true,
      }),
    ).toBe('♪ Tweezer — Phish');
  });

  it('shows a pending state when identify is in flight', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: null,
        identifyPending: true,
      }),
    ).toBe('Identifying song…');
  });

  it('returns null when nothing is pending or matched', () => {
    expect(
      resolveCaptureHudSongLabel({
        identifiedTitle: null,
        liveMatch: null,
        identifyPending: false,
      }),
    ).toBeNull();
  });
});

describe('isHudSongIdentifyPending', () => {
  it('is pending when the queued job is still identifying', () => {
    expect(isHudSongIdentifyPending({ songIdentifyPending: true }, null)).toBe(true);
    expect(isHudSongIdentifyPending({}, null)).toBe(true);
  });

  it('is not pending after a title lands or the job finished', () => {
    expect(isHudSongIdentifyPending({ songIdentifyPending: false }, null)).toBe(false);
    expect(isHudSongIdentifyPending({ songIdentifyPending: true }, 'Tweezer')).toBe(false);
    expect(isHudSongIdentifyPending(null, null)).toBe(false);
  });
});
