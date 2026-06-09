import { describe, expect, it } from 'vitest';
import { MAIN_FEED_CLIP_SQL } from '../shared/content-feed';

describe('content-feed-sql', () => {
  it('main feed filter references content_feed column when migrated', () => {
    expect(MAIN_FEED_CLIP_SQL).toContain('content_feed');
  });
});
