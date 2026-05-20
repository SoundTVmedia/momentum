import { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router';

export type HeroSearchBarProps = {
  /** Prefill from URL when landing with ?q= */
  initialQuery?: string;
  className?: string;
};

/** Primary discovery entry — submits to full Discover search results. */
export default function HeroSearchBar({
  initialQuery = '',
  className = '',
}: HeroSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      navigate(`/discover?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/discover');
    }
  };

  return (
    <form onSubmit={submit} className={`w-full max-w-2xl mx-auto ${className}`.trim()}>
      <div className="relative group">
        <div
          className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-momentum-teal/50 via-momentum-mint/40 to-momentum-teal/50 opacity-60 blur-sm transition-opacity group-focus-within:opacity-100"
          aria-hidden
        />
        <div className="relative flex items-center rounded-2xl border border-white/20 bg-black/50 backdrop-blur-md shadow-xl shadow-black/40">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-momentum-mint/80 sm:h-6 sm:w-6"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, venues, songs, clips…"
            className="w-full min-w-0 flex-1 bg-transparent py-3.5 pl-12 pr-28 text-base text-white placeholder:text-gray-400 focus:outline-none sm:py-4 sm:text-lg"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-4 py-2 text-sm font-semibold text-white momentum-grad-interactive transition-transform hover:scale-[1.02] sm:px-5 sm:py-2.5 sm:text-base"
          >
            Search
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-gray-500 sm:text-sm">
        Or{' '}
        <button
          type="button"
          onClick={() => navigate('/discover')}
          className="text-momentum-mint/90 underline-offset-2 hover:text-momentum-mint hover:underline"
        >
          browse everything on Discover
        </button>
      </p>
    </form>
  );
}
