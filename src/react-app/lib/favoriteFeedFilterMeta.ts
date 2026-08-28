export type FavoriteFeedFilterValue = 'all' | 'artists' | 'venues' | 'songs' | 'friends';

export type FavoriteFeedFilterMeta = {
  value: FavoriteFeedFilterValue;
  label: string;
  description: string;
};

export const FAVORITE_FEED_FILTER_OPTIONS: FavoriteFeedFilterMeta[] = [
  {
    value: 'all',
    label: 'All clips',
    description: 'Clips from everyone and everything you follow',
  },
  {
    value: 'artists',
    label: 'Artists',
    description: 'Clips from artists you follow',
  },
  {
    value: 'venues',
    label: 'Venues',
    description: 'Clips from venues you follow',
  },
  {
    value: 'songs',
    label: 'Songs',
    description: 'Clips tagged with songs you saved',
  },
  {
    value: 'friends',
    label: 'Friends',
    description: 'All clips from people you follow',
  },
];

export function getFavoriteFeedFilterMeta(
  filter: FavoriteFeedFilterValue = 'all',
): FavoriteFeedFilterMeta {
  return (
    FAVORITE_FEED_FILTER_OPTIONS.find((o) => o.value === filter) ??
    FAVORITE_FEED_FILTER_OPTIONS[0]
  );
}
