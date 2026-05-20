import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  FEED_FILTER_OPTIONS,
  type FeedFilterValue,
} from '@/react-app/lib/feedFilterMeta';

interface FeedFiltersProps {
  currentFilter: FeedFilterValue;
  onFilterChange: (filter: FeedFilterValue) => void;
}

export default function FeedFilters({ currentFilter, onFilterChange }: FeedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption =
    FEED_FILTER_OPTIONS.find((opt) => opt.value === currentFilter) ?? FEED_FILTER_OPTIONS[0];

  return (
    <div className="relative">
      <div className="hidden md:flex items-center space-x-2 bg-black/40 backdrop-blur-lg border border-momentum-teal/20 rounded-xl p-2">
        {FEED_FILTER_OPTIONS.map((option) => {
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
          className="w-full flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-lg border border-momentum-teal/20 rounded-xl text-white"
        >
          <span className="font-medium">{currentOption.label}</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden
            />

            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-momentum-teal/20 rounded-xl overflow-hidden z-50 shadow-2xl">
              {FEED_FILTER_OPTIONS.map((option) => {
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
                        ? 'bg-cyan-500/20 border-l-4 border-momentum-teal'
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
