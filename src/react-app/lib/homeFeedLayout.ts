/** Bleed carousels inside nested shells (e.g. profile hub card). */
export const HOME_FEED_CAROUSEL_BLEED =
  '-mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 md:pt-1';

/** Bleed within max-w-7xl page shells (Discover, signed-in home feed). */
export const PAGE_CAROUSEL_BLEED =
  '-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 md:pt-1';

/** Spacing between unboxed home feed sections (tighter on desktop). */
export const HOME_FEED_SECTION_CLASS = 'mb-8 md:mb-6';

/** Equal-height event cards in carousels (image + body + ticket row). */
export const EVENT_CAROUSEL_CARD_CLASS =
  'flex h-full min-h-[24rem] w-full flex-col';

/** Mobile carousel tiles: ~one card plus a peek of the next (swipe affordance). */
export const MOBILE_CAROUSEL_ITEM_PEEK_CLASS =
  'max-md:w-[82%] max-md:max-w-[82%] max-md:basis-[82%]';

/** Equal-height YouTube cards in carousels (fixed thumb + reserved title/artist/footer). */
export const YOUTUBE_CAROUSEL_CARD_CLASS =
  'flex h-full min-h-[17.75rem] w-full flex-col';

/** Fixed thumbnail height — keeps every YouTube card the same size. */
export const YOUTUBE_CARD_THUMB_CLASS =
  'relative h-[9.5625rem] shrink-0 overflow-hidden bg-white/5';

export const YOUTUBE_CARD_BODY_CLASS =
  'flex flex-1 flex-col p-4 min-h-[5.5rem]';

export const YOUTUBE_CARD_TITLE_CLASS =
  'line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-white transition-colors group-hover:text-momentum-mint';

export const YOUTUBE_CARD_ARTIST_SLOT_CLASS = 'mt-1 h-5 shrink-0 truncate text-xs text-momentum-flare/90';

export const YOUTUBE_CARD_STATS_CLASS =
  'mt-auto flex h-6 shrink-0 flex-wrap items-center gap-3 pt-3 text-xs text-gray-400';
