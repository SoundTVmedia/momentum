import { describe, expect, it } from 'vitest';
import {
  clipQualifiesForLatestScene,
  LATEST_SCENE_MAX_AGE_MS,
  LATEST_SCENE_PREFERRED_AGE_MS,
} from './latest-scene-feed';

describe('clipQualifiesForLatestScene', () => {
  const now = Date.parse('2026-08-25T20:00:00.000Z');

  it('keeps a clip posted within 24 hours of the show', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-08-25T02:00:00.000Z',
        createdAt: '2026-08-25T18:00:00.000Z',
        maxAgeMs: LATEST_SCENE_PREFERRED_AGE_MS,
      }),
    ).toBe(true);
  });

  it('drops a clip posted more than 30 days after the show', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-07-20T18:00:00.000Z',
        createdAt: '2026-08-25T20:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('keeps a clip posted a few days after the show inside the 30-day cap', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: '2026-08-10T18:00:00.000Z',
        createdAt: '2026-08-12T20:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('keeps unmatched clips even when they were recorded or uploaded later', () => {
    expect(clipQualifiesForLatestScene({ nowMs: now })).toBe(true);
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        showStartAt: null,
        createdAt: '2026-08-25T20:00:00.000Z',
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

  it('uses a 30-day fallback window', () => {
    expect(LATEST_SCENE_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
