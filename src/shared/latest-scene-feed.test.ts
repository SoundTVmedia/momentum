import { describe, expect, it } from 'vitest';
import {
  clipQualifiesForLatestScene,
  LATEST_SCENE_MAX_AGE_MS,
} from './latest-scene-feed';

describe('clipQualifiesForLatestScene', () => {
  const now = Date.parse('2026-08-25T20:00:00.000Z');

  it('keeps a clip tagged to a show from the last 30 days', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-08-10T18:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('keeps a just-uploaded clip when the tagged show is still within 30 days', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-08-15T02:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('drops a clip tagged to a show older than 30 days, even if the upload is new', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-07-20T18:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('keeps unmatched clips even when they were recorded or uploaded later', () => {
    expect(clipQualifiesForLatestScene({ nowMs: now })).toBe(true);
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: null,
      }),
    ).toBe(true);
  });

  it('keeps clips with an unparseable show start rather than emptying Latest', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: 'not-a-date',
      }),
    ).toBe(true);
  });

  it('uses a 30-day event window', () => {
    expect(LATEST_SCENE_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
