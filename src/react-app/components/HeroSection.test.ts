import { describe, expect, it } from 'vitest';
import { mergeFeaturedShowFeed } from '@/react-app/components/HeroSection';
import type { ClipWithUser } from '@/shared/types';

function clip(id: number, artist = 'Wet Leg'): ClipWithUser {
  return { id, artist_name: artist } as ClipWithUser;
}

describe('mergeFeaturedShowFeed', () => {
  it('returns the featured clip when there are no related clips', () => {
    const featured = clip(1);
    expect(mergeFeaturedShowFeed(featured, [])).toEqual([featured]);
  });

  it('keeps show order when the featured clip is already in the related list', () => {
    const a = clip(1);
    const b = clip(2);
    const c = clip(3);
    expect(mergeFeaturedShowFeed(b, [a, b, c])).toEqual([a, b, c]);
  });

  it('prepends the featured clip when it is missing from the related list', () => {
    const featured = clip(9);
    const related = [clip(1), clip(2)];
    expect(mergeFeaturedShowFeed(featured, related)).toEqual([featured, ...related]);
  });
});
