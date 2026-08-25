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

  it('uses recording time when the show start is missing', () => {
    expect(
      clipQualifiesForLatestScene({
        nowMs: now,
        recordedAt: new Date(now - LATEST_SCENE_MAX_AGE_MS - 1000).toISOString(),
      }),
    ).toBe(false);
  });

  it('keeps unmatched clips with no dates', () => {
    expect(clipQualifiesForLatestScene({ nowMs: now })).toBe(true);
  });
});
