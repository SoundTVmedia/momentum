import { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { searchOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router';
import AdvancedSearchDropdown, {
  UNIVERSAL_SEARCH_SECTIONS,
} from '@/react-app/components/AdvancedSearchDropdown';
import ClipModal from '@/react-app/components/ClipModal';
import { useAdvancedSearch } from '@/react-app/hooks/useAdvancedSearch';
import type { ClipWithUser } from '@/shared/types';

export type HeroSearchBarProps = {
  /** Prefill from URL when landing with ?q= */
  initialQuery?: string;
  className?: string;
};

/** Primary discovery entry — artists, venues, people, events, and songs. Enter → Discover. */
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
        <div ref={containerRef} className="relative z-10">
          <div className="hero-search-pill">
            <span className="hero-search-mark" aria-hidden>
              <img src="/favicon.svg" alt="" width={28} height={28} />
            </span>
            <input
              type="search"
              className="hero-search-input"
              value={query}
              placeholder="Search artists, friends, venues, songs…"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Search artists, friends, venues, songs"
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setShowResults(true)}
            />
            <button type="submit" className="hero-search-submit" aria-label="Search">
              <IonIcon icon={searchOutline} />
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
            sections={UNIVERSAL_SEARCH_SECTIONS}
            anchorRef={containerRef}
            dropdownRef={dropdownRef}
          />
        </div>
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
