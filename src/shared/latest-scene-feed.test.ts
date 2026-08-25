import { describe, expect, it } from 'vitest';
import { clipQualifiesForLatestScene, LATEST_SCENE_MAX_AGE_MS } from './latest-scene-feed';

describe('clipQualifiesForLatestScene', () => {
  const now = Date.parse('2026-08-25T20:00:00.000Z');

  it('keeps clips from a show that started within 24 hours', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-08-25T02:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('drops clips whose associated show started more than 24 hours ago', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-08-24T18:00:00.000Z',
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

  it('uses a 24-hour window from show start', () => {
    expect(LATEST_SCENE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
