/**
 * Generic hero backdrop — two calm concert stills (Unsplash).
 */
export type HeroStockSlide = {
  id: string;
  poster: string;
};

export const HERO_CONCERT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=720&fit=crop&q=85&auto=format';

/** Hands in the air → musicians on stage. */
export const HERO_STOCK_SLIDES: HeroStockSlide[] = [
  {
    id: 'hands-up',
    poster: HERO_CONCERT_FALLBACK_IMAGE,
  },
  {
    id: 'on-stage',
    poster:
      'https://images.unsplash.com/photo-1511671782779-c97d1d11329c?w=1920&h=720&fit=crop&q=85&auto=format',
  },
];
