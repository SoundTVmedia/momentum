export type FeedFilterValue = 'latest' | 'trending' | 'most_liked';

export type FeedFilterMeta = {
  value: FeedFilterValue;
  label: string;
  description: string;
  viewAllClipsLabel: string;
};

export const FEED_FILTER_OPTIONS: FeedFilterMeta[] = [
  {
    value: 'latest',
    label: 'From The Scene',
    description: "The latest clips from tonight's shows",
    viewAllClipsLabel: 'View All Latest Clips',
  },
  {
    value: 'trending',
    label: 'Trending',
    description: 'Clips with the most likes and views',
    viewAllClipsLabel: 'View All Trending Clips',
  },
  {
    value: 'most_liked',
    label: 'Most Liked',
    description: 'The clips fans love most',
    viewAllClipsLabel: 'View All Most Liked Clips',
  },
];

export function getFeedFilterMeta(
  feedType: FeedFilterValue = 'latest',
): FeedFilterMeta {
  return FEED_FILTER_OPTIONS.find((o) => o.value === feedType) ?? FEED_FILTER_OPTIONS[0];
}
