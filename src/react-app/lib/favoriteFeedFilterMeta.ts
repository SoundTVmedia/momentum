export type FavoriteFeedFilterValue = 'latest' | 'upcoming';

export type FavoriteFeedFilterMeta = {
  value: FavoriteFeedFilterValue;
  label: string;
  description: string;
};

export const FAVORITE_FEED_FILTER_OPTIONS: FavoriteFeedFilterMeta[] = [
  {
    value: 'latest',
    label: 'Latest From Your Favorites',
    description: 'Fresh clips from artists you follow',
  },
  {
    value: 'upcoming',
    label: 'Upcoming Shows',
    description: 'Tour dates for your favorite artists',
  },
];

export function getFavoriteFeedFilterMeta(
  filter: FavoriteFeedFilterValue = 'latest',
): FavoriteFeedFilterMeta {
  return (
    FAVORITE_FEED_FILTER_OPTIONS.find((o) => o.value === filter) ??
    FAVORITE_FEED_FILTER_OPTIONS[0]
  );
}
