import { useState } from 'react';
import { TrendingUp, Clock, Heart, Star, ChevronDown } from 'lucide-react';

interface FeedFiltersProps {
  currentFilter: 'latest' | 'trending' | 'most_liked' | 'top_rated';
  onFilterChange: (filter: 'latest' | 'trending' | 'most_liked' | 'top_rated') => void;
}

const filterOptions = [
  {
    value: 'latest' as const,
    label: 'Latest',
    icon: Clock,
    description: 'Fresh drops from tonight\'s shows',
  },
  {
    value: 'trending' as const,
    label: 'Trending',
    icon: TrendingUp,
    description: 'What everyone\'s watching',
  },
  {
    value: 'most_liked' as const,
    label: 'Most Liked',
    icon: Heart,
    description: 'Fan favorites',
  },
  {
    value: 'top_rated' as const,
    label: 'Top Rated',
    icon: Star,
    description: 'Highest rated moments',
  },
];

export default function FeedFilters({ currentFilter, onFilterChange }: FeedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = filterOptions.find(opt => opt.value === currentFilter) || filterOptions[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div className="relative">
      {/* Desktop: Tabs */}
      <div className="hidden md:flex items-center space-x-2 bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-2">
        {filterOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentFilter === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile: Dropdown */}
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl text-white"
        >
          <div className="flex items-center space-x-2">
            <CurrentIcon className="w-5 h-5 text-cyan-400" />
            <span className="font-medium">{currentOption.label}</span>
          </div>
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown Menu */}
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-cyan-500/20 rounded-xl overflow-hidden z-50 shadow-2xl">
              {filterOptions.map((option) => {
                const Icon = option.icon;
                const isActive = currentFilter === option.value;
                
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onFilterChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-start space-x-3 px-4 py-3 transition-colors ${
                      isActive
                        ? 'bg-cyan-500/20 border-l-4 border-cyan-500'
                        : 'hover:bg-white/5 border-l-4 border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      isActive ? 'text-cyan-400' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${
                        isActive ? 'text-white' : 'text-gray-300'
                      }`}>
                        {option.label}
                      </div>
                      <div className="text-sm text-gray-400">{option.description}</div>
                    </div>
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
