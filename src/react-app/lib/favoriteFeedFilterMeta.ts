export type FavoriteFeedFilterValue = 'artists' | 'venues' | 'songs' | 'upcoming' | 'friends';

export type FavoriteFeedFilterMeta = {
  value: FavoriteFeedFilterValue;
  label: string;
  description: string;
};

export const FAVORITE_FEED_FILTER_OPTIONS: FavoriteFeedFilterMeta[] = [
  {
    value: 'artists',
    label: 'Your Artists',
    description: 'Clips from artists you follow',
  },
  {
    value: 'venues',
    label: 'Your Venues',
    description: 'Clips from venues you follow',
  },
  {
    value: 'songs',
    label: 'Your Songs',
    description: 'Clips tagged with songs you saved',
  },
  {
    value: 'upcoming',
    label: 'Nearest Shows',
    description: 'Tour dates from your favorite artists',
  },
  {
    value: 'friends',
    label: 'Your Friends',
    description: 'All clips from people you follow',
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
