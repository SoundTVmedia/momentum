import { describe, expect, it } from 'vitest';
import { classifyContentFeed } from './content-feed';

describe('classifyContentFeed', () => {
  it('routes ACR + headliner match to main feed', () => {
    const r = classifyContentFeed({
      acrMatch: { artist: 'Taylor Swift', title: 'Anti-Hero' },
      headlinerName: 'Taylor Swift',
      hasSpeech: false,
    });
    expect(r.content_feed).toBe('main');
    expect(r.headliner_matched).toBe(true);
  });

  it('rejects ACR match when headliner differs', () => {
    const r = classifyContentFeed({
      acrMatch: { artist: 'Drake', title: 'God\'s Plan' },
      headlinerName: 'Taylor Swift',
      hasSpeech: true,
    });
    expect(r.content_feed).toBe('rejected');
    if (r.content_feed === 'rejected') {
      expect(r.reason).toBe('acr_no_headliner_match');
    }
  });

  it('routes no ACR + speech to pre_post', () => {
    const r = classifyContentFeed({
      acrMatch: null,
      headlinerName: 'Taylor Swift',
      hasSpeech: true,
    });
    expect(r.content_feed).toBe('pre_post');
  });

  it('rejects no ACR and no speech', () => {
    const r = classifyContentFeed({
      acrMatch: null,
      headlinerName: 'Taylor Swift',
      hasSpeech: false,
    });
    expect(r.content_feed).toBe('rejected');
    if (r.content_feed === 'rejected') {
      expect(r.reason).toBe('no_acr_no_speech');
    }
  });
});
