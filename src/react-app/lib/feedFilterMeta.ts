export type FeedFilterValue = 'latest' | 'trending' | 'most_liked';

export type FeedFilterMeta = {
  value: FeedFilterValue;
  label: string;
  description: string;
};

export const FEED_FILTER_OPTIONS: FeedFilterMeta[] = [
  {
    value: 'latest',
    label: 'Latest',
    description: "Fresh drops from tonight's shows",
  },
  {
    value: 'trending',
    label: 'Trending',
    description: "What everyone's watching right now",
  },
  {
    value: 'most_liked',
    label: 'Most Liked',
    description: 'The clips fans love most',
  },
];

export function getFeedFilterMeta(
  feedType: FeedFilterValue = 'latest',
): FeedFilterMeta {
  return FEED_FILTER_OPTIONS.find((o) => o.value === feedType) ?? FEED_FILTER_OPTIONS[0];
}
