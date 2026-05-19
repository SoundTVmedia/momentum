import { describe, expect, it } from 'vitest';
import {
  buildHashtagsArrayForPost,
} from './clip-hashtags';
import { songHashtagToken, songSlugFromTitle, songTitleFromSlug } from './song-tag';

describe('song-tag', () => {
  it('builds song hashtag token', () => {
    expect(songHashtagToken('Wonderwall')).toBe('song:wonderwall');
    expect(songSlugFromTitle('Mr. Brightside')).toBe('mr-brightside');
  });

  it('adds song tag when building hashtags', () => {
    const tags = buildHashtagsArrayForPost('#live', 'Oasis', 'Wonderwall');
    expect(tags).toContain('live');
    expect(tags).toContain('Oasis');
    expect(tags).toContain('song:wonderwall');
  });

  it('adds genre tag when building hashtags', () => {
    const tags = buildHashtagsArrayForPost('', 'Oasis', 'Wonderwall', 'Rock');
    expect(tags).toContain('genre:rock');
  });

  it('derives display title from slug', () => {
    expect(songTitleFromSlug('wonderwall')).toBe('Wonderwall');
  });
});
