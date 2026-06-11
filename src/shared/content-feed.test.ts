import { describe, expect, it } from 'vitest';
import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  classifyContentFeed,
  effectiveContentFeedForPost,
  hasManualShowPostDetails,
} from './content-feed';

describe('classifyContentFeed', () => {
  it('routes ACR + headliner match to main feed', () => {
    const r = classifyContentFeed({
      acrMatch: { artist: 'Taylor Swift', title: 'Anti-Hero' },
      headlinerName: 'Taylor Swift',
    });
    expect(r.content_feed).toBe('main');
    expect(r.headliner_matched).toBe(true);
  });

  it('routes ACR match without headliner to main (artist required at post)', () => {
    const r = classifyContentFeed({
      acrMatch: { artist: 'Taylor Swift', title: 'Anti-Hero' },
      headlinerName: null,
    });
    expect(r.content_feed).toBe('main');
    expect(r.headliner_matched).toBe(false);
    expect(r.reason).toBe('acr_pending_headliner');
  });

  it('rejects ACR match when headliner differs', () => {
    const r = classifyContentFeed({
      acrMatch: { artist: 'Drake', title: "God's Plan" },
      headlinerName: 'Taylor Swift',
    });
    if (BYPASS_CONTENT_FEED_BIFURCATION) {
      expect(r.content_feed).toBe('main');
      expect(r.headliner_matched).toBe(false);
    } else {
      expect(r.content_feed).toBe('rejected');
      if (r.content_feed === 'rejected') {
        expect(r.reason).toBe('acr_no_headliner_match');
      }
    }
  });

  it('routes no ACR to main for manual performance entry', () => {
    const r = classifyContentFeed({
      acrMatch: null,
      headlinerName: 'Taylor Swift',
    });
    expect(r.content_feed).toBe('main');
    expect(r.reason).toBe('no_acr');
    expect(r.has_speech).toBe(false);
  });

  it('effectiveContentFeedForPost maps pre_post to main when bypass is on', () => {
    if (BYPASS_CONTENT_FEED_BIFURCATION) {
      expect(effectiveContentFeedForPost('pre_post')).toBe('main');
      expect(effectiveContentFeedForPost('rejected')).toBe('main');
    }
    expect(effectiveContentFeedForPost('main')).toBe('main');
  });

  it('hasManualShowPostDetails requires venue, event title, and date', () => {
    expect(
      hasManualShowPostDetails({
        venueName: 'Madison Square Garden',
        eventTitle: 'Taylor Swift at Madison Square Garden',
        eventDateIso: '2026-06-10T12:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      hasManualShowPostDetails({
        venueName: 'Madison Square Garden',
        artistName: 'Taylor Swift',
        eventDateIso: '2026-06-10T12:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      hasManualShowPostDetails({
        venueName: 'Madison Square Garden',
        eventTitle: 'Taylor Swift at Madison Square Garden',
        eventDateIso: null,
      }),
    ).toBe(false);
    expect(
      hasManualShowPostDetails({
        venueName: '',
        eventTitle: 'Taylor Swift at Madison Square Garden',
        eventDateIso: '2026-06-10T12:00:00.000Z',
      }),
    ).toBe(false);
  });
});
