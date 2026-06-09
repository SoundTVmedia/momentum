export type FavoriteFeedFilterValue = 'artists' | 'upcoming';

export type FavoriteFeedFilterMeta = {
  value: FavoriteFeedFilterValue;
  label: string;
  description: string;
};

export const FAVORITE_FEED_FILTER_OPTIONS: FavoriteFeedFilterMeta[] = [
  {
    value: 'artists',
    label: 'Artists',
    description: 'Clips from artists you follow',
  },
  {
    value: 'upcoming',
    label: 'Nearest Shows',
    description: 'Tour dates from your favorite artists',
  },
];

export function getFavoriteFeedFilterMeta(
  filter: FavoriteFeedFilterValue = 'artists',
): FavoriteFeedFilterMeta {
  return (
    FAVORITE_FEED_FILTER_OPTIONS.find((o) => o.value === filter) ??
    FAVORITE_FEED_FILTER_OPTIONS[0]
  );
}
