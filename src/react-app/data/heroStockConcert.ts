/**
 * Generic hero backdrop — royalty-free live-concert stock (Pexels) + Unsplash posters.
 * User-generated clip montage can replace this later when we wire it up.
 */
export type HeroStockSlide = {
  id: string;
  /** Shown while video loads and when motion is reduced. */
  poster: string;
  /** Pexels CDN — 1080p horizontal concert b-roll. */
  videoSrc: string;
};

export const HERO_CONCERT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&h=720&fit=crop&q=85&auto=format';

/** ~0.7 feels like gentle slow-mo on energetic crowd/stage footage. */
export const HERO_STOCK_VIDEO_PLAYBACK_RATE = 0.72;

export const HERO_STOCK_SLIDES: HeroStockSlide[] = [
  {
    id: 'crowd-lights',
    poster:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&h=720&fit=crop&q=85&auto=format',
    videoSrc:
      'https://videos.pexels.com/video-files/3195394/3195394-hd_1920_1080_25fps.mp4',
  },
  {
    id: 'stage-energy',
    poster:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=720&fit=crop&q=85&auto=format',
    videoSrc:
      'https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_25fps.mp4',
  },
  {
    id: 'festival-crowd',
    poster:
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1920&h=720&fit=crop&q=85&auto=format',
    videoSrc:
      'https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4',
  },
  {
    id: 'live-show',
    poster:
      'https://images.unsplash.com/photo-1459747756716-974bf16472ae?w=1920&h=720&fit=crop&q=85&auto=format',
    videoSrc:
      'https://videos.pexels.com/video-files/4769638/4769638-hd_1920_1080_30fps.mp4',
  },
];
