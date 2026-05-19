import type { LucideIcon } from 'lucide-react';
import { Clock, Heart, Star, TrendingUp } from 'lucide-react';

export type FeedFilterValue = 'latest' | 'trending' | 'most_liked' | 'top_rated';

export type FeedFilterMeta = {
  value: FeedFilterValue;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  description: string;
};

export const FEED_FILTER_OPTIONS: FeedFilterMeta[] = [
  {
    value: 'latest',
    label: 'Latest',
    icon: Clock,
    iconClassName: 'text-cyan-400',
    description: "Fresh drops from tonight's shows",
  },
  {
    value: 'trending',
    label: 'Trending',
    icon: TrendingUp,
    iconClassName: 'text-cyan-400',
    description: "What everyone's watching right now",
  },
  {
    value: 'most_liked',
    label: 'Most Liked',
    icon: Heart,
    iconClassName: 'text-cyan-400',
    description: 'Clips the community hearts the most',
  },
  {
    value: 'top_rated',
    label: 'Top Rated',
    icon: Star,
    iconClassName: 'text-cyan-400',
    description: 'The highest rated concert moments',
  },
];

export function getFeedFilterMeta(
  feedType: FeedFilterValue = 'latest',
): FeedFilterMeta {
  return FEED_FILTER_OPTIONS.find((o) => o.value === feedType) ?? FEED_FILTER_OPTIONS[0];
}
