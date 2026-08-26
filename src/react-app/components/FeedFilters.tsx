import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';
import { FEED_FILTER_OPTIONS } from '@/react-app/lib/feedFilterMeta';

export type FilterToggleOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

type FeedFiltersProps<T extends string> = {
  options?: FilterToggleOption<T>[];
  currentFilter: T;
  onFilterChange: (filter: T) => void;
};

export default function FeedFilters<T extends string>({
  options,
  currentFilter,
  onFilterChange,
}: FeedFiltersProps<T>) {
  const filterOptions = (options ?? FEED_FILTER_OPTIONS) as FilterToggleOption<T>[];

  return (
    <IonSegment
      className="app-feed-segment"
      value={currentFilter}
      onIonChange={(e) => {
        const next = e.detail.value;
        if (typeof next === 'string' && next) {
          onFilterChange(next as T);
        }
      }}
    >
      {filterOptions.map((option) => (
        <IonSegmentButton key={option.value} value={option.value}>
          <IonLabel>{option.label}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
}
