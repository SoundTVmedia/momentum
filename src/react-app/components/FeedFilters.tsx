import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const filterOptions = (options ?? FEED_FILTER_OPTIONS) as FilterToggleOption<T>[];

  const currentOption =
    filterOptions.find((opt) => opt.value === currentFilter) ?? filterOptions[0];

  return (
    <div className="relative">
      <div className="hidden md:flex items-center space-x-2 glass-panel rounded-xl p-2">
        {filterOptions.map((option) => {
          const isActive = currentFilter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`px-4 py-2 rounded-lg transition-all font-medium ${
                isActive
                  ? 'momentum-grad-interactive text-white'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 glass-panel rounded-xl text-white"
        >
          <span className="font-medium">{currentOption.label}</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 glass-modal-overlay z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden
            />

            <div className="absolute top-full left-0 right-0 mt-2 glass-dropdown rounded-xl overflow-hidden z-50">
              {filterOptions.map((option) => {
                const isActive = currentFilter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onFilterChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-momentum-ember/20 border-l-4 border-momentum-ember'
                        : 'hover:bg-white/5 border-l-4 border-transparent'
                    }`}
                  >
                    <div className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-400">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
