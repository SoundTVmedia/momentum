import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  /** `menu` = compact dropdown (favorites). Default is the scene segment bar. */
  variant?: 'segment' | 'menu';
};

export default function FeedFilters<T extends string>({
  options,
  currentFilter,
  onFilterChange,
  variant = 'segment',
}: FeedFiltersProps<T>) {
  const filterOptions = (options ?? FEED_FILTER_OPTIONS) as FilterToggleOption<T>[];
  const current =
    filterOptions.find((option) => option.value === currentFilter) ?? filterOptions[0];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (event: MouseEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (variant === 'menu') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`View ${current?.label ?? 'feed'}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 hover:border-white transition-colors"
        >
          <span>{current?.label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl glass-dropdown py-1 shadow-xl"
          >
            {filterOptions.map((option) => {
              const selected = option.value === currentFilter;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  title={option.description}
                  onClick={() => {
                    onFilterChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col items-start px-3 py-2.5 text-left text-sm transition-colors ${
                    selected
                      ? 'bg-white/10 text-momentum-flare'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 text-xs font-normal text-gray-400">{option.description}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

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
