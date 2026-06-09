export type FeedFilterValue = 'latest' | 'most_liked' | 'most_viewed';

export type FeedFilterMeta = {
  value: FeedFilterValue;
  label: string;
  description: string;
  viewAllClipsLabel: string;
};

/** Static heading for the home / feed "From The Scene" block (toggle labels are separate). */
export const FROM_THE_SCENE_SECTION = {
  title: 'From The Scene',
  description: "Clips from tonight's shows and the community",
} as const;

export const FEED_FILTER_OPTIONS: FeedFilterMeta[] = [
  {
    value: 'latest',
    label: 'Latest',
    description: "The latest clips from tonight's shows",
    viewAllClipsLabel: 'View All Latest Clips',
  },
  {
    value: 'most_liked',
    label: 'Most Liked',
    description: 'The clips fans love most',
    viewAllClipsLabel: 'View All Most Liked Clips',
  },
  {
    value: 'most_viewed',
    label: 'Most Viewed',
    description: 'The clips getting the most plays',
    viewAllClipsLabel: 'View All Most Viewed Clips',
  },
];

export function getFeedFilterMeta(
  feedType: FeedFilterValue = 'latest',
): FeedFilterMeta {
  return FEED_FILTER_OPTIONS.find((o) => o.value === feedType) ?? FEED_FILTER_OPTIONS[0];
}
