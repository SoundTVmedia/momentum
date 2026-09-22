import { describe, expect, it } from 'vitest';
import {
  assignHeroCarouselClips,
  mergeFeaturedShowFeed,
} from '@/react-app/components/HeroSection';
import { clipToHeroSlide } from '@/react-app/components/HeroConcertBackdrop';
import type { ClipWithUser } from '@/shared/types';

function clip(id: number, artist = 'Wet Leg'): ClipWithUser {
  return { id, artist_name: artist } as ClipWithUser;
}

function playable(id: number, name = `Fan ${id}`): ClipWithUser {
  return {
    id,
    video_url: `https://cdn.example.com/clip-${id}.mp4`,
    user_display_name: name,
  } as ClipWithUser;
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

describe('assignHeroCarouselClips', () => {
  it('gives slides 1 and 2 a single different clip and uses a leftover liked clip as featured', () => {
    const a = playable(1);
    const b = playable(2);
    const featured = playable(3);
    const assigned = assignHeroCarouselClips([a, b, featured], [featured]);

    expect(assigned.slideA).toHaveLength(1);
    expect(assigned.slideB).toHaveLength(1);
    expect(assigned.slideA[0]?.src).toBe(clipToHeroSlide(a)?.src);
    expect(assigned.slideB[0]?.src).toBe(clipToHeroSlide(b)?.src);
    expect(assigned.slideA[0]?.src).not.toBe(assigned.slideB[0]?.src);
    expect(assigned.featured).toBe(featured);
  });

  it('keeps slides 1 and 2 different when there are only two playable clips', () => {
    const a = playable(1);
    const b = playable(2);
    const assigned = assignHeroCarouselClips([a, b], [a]);

    expect(assigned.slideA[0]?.src).toBe(clipToHeroSlide(a)?.src);
    expect(assigned.slideB[0]?.src).toBe(clipToHeroSlide(b)?.src);
    expect(assigned.featured).toBe(a);
  });

  it('reuses the only playable clip across slides', () => {
    const a = playable(1);
    const assigned = assignHeroCarouselClips([a], [a]);

    expect(assigned.slideA[0]?.src).toBe(clipToHeroSlide(a)?.src);
    expect(assigned.slideB[0]?.src).toBe(clipToHeroSlide(a)?.src);
    expect(assigned.featured).toBe(a);
  });
});
