import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import AdvancedSearchDropdown from '@/react-app/components/AdvancedSearchDropdown';
import ClipModal from '@/react-app/components/ClipModal';
import { useAdvancedSearch } from '@/react-app/hooks/useAdvancedSearch';
import type { ClipWithUser } from '@/shared/types';

export type HeroSearchBarProps = {
  /** Prefill from URL when landing with ?q= */
  initialQuery?: string;
  className?: string;
};

/** Primary discovery entry — live JamBase + Feedback search with dropdown, Enter → Discover. */
export default function HeroSearchBar({
  initialQuery = '',
  className = '',
}: HeroSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [showResults, setShowResults] = useState(false);
  const { results, loading, revalidating, scheduleSearch, cancelSearch, reset } =
    useAdvancedSearch();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [clipModal, setClipModal] = useState<{
    clip: ClipWithUser;
    feed: ClipWithUser[];
  } | null>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!showResults) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (containerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setShowResults(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [showResults]);

  const closeSearchUi = useCallback(() => {
    setShowResults(false);
    reset();
  }, [reset]);

  const handleInput = (value: string) => {
    setQuery(value);
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      setShowResults(true);
      scheduleSearch(value);
    } else {
      cancelSearch();
      setShowResults(false);
    }
  };

  const goToDiscover = () => {
    const q = query.trim();
    closeSearchUi();
    if (q) {
      navigate(`/discover?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/discover?focus=1');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    goToDiscover();
  };

  return (
    <>
      <form
        onSubmit={submit}
        className={`w-full ${className}`.trim()}
      >
        <div ref={containerRef} className="relative group z-10">
          <div
            className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-momentum-ember/50 via-momentum-flare/40 to-momentum-ember/50 opacity-60 blur-sm transition-opacity group-focus-within:opacity-100"
            aria-hidden
          />
          <div className="relative flex items-center rounded-2xl glass-input shadow-glass-lg">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-momentum-flare/80 sm:h-6 sm:w-6"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setShowResults(true)}
              placeholder="Search artists, venues, songs, clips…"
              className="w-full min-w-0 flex-1 bg-transparent py-3.5 pl-12 pr-28 text-base text-white placeholder:text-gray-400 focus:outline-none sm:py-4 sm:text-lg"
              autoComplete="off"
              enterKeyHint="search"
              aria-autocomplete="list"
              aria-expanded={showResults}
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-4 py-2 text-sm font-semibold text-white momentum-grad-interactive transition-transform hover:scale-[1.02] sm:px-5 sm:py-2.5 sm:text-base"
            >
              Search
            </button>
          </div>

          <AdvancedSearchDropdown
            query={query}
            open={showResults}
            loading={loading}
            revalidating={revalidating}
            results={results}
            onClose={closeSearchUi}
            onDiscoverAll={goToDiscover}
            onClipSelect={(clip, feed) => setClipModal({ clip, feed })}
            variant="hero"
            anchorRef={containerRef}
            dropdownRef={dropdownRef}
          />
        </div>
        <p className="mt-3 text-center text-xs text-gray-500 sm:text-sm">
          Or{' '}
          <button
            type="button"
            onClick={() => navigate('/discover')}
            className="text-momentum-flare/90 underline-offset-2 hover:text-momentum-flare hover:underline"
          >
            browse everything on Discover
          </button>
        </p>
      </form>

      {clipModal ? (
        <ClipModal
          clip={clipModal.clip}
          onClose={() => setClipModal(null)}
          feedNavigation={
            clipModal.feed.length > 1
              ? {
                  clips: clipModal.feed,
                  onChangeClip: (c) =>
                    setClipModal((m) => (m ? { ...m, clip: c } : null)),
                }
              : null
          }
        />
      ) : null}
    </>
  );
}
