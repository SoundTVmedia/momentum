import type { FeedFilterValue } from '@/react-app/lib/feedFilterMeta';

export function browseClipsPath(feedType: FeedFilterValue): string {
  return `/browse/clips/${feedType.replace('_', '-')}`;
}

export const BROWSE_FAVORITE_CLIPS_PATH = '/browse/favorites/clips';
export const BROWSE_FAVORITE_SHOWS_PATH = '/browse/favorites/shows';
export const BROWSE_NEARBY_SHOWS_PATH = '/browse/shows/nearby';
