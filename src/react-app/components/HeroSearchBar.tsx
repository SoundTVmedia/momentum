import { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton, IonSearchbar } from '@ionic/react';
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
        <div ref={containerRef} className="relative z-10">
          <div className="relative flex items-center gap-1.5 overflow-hidden rounded-full glass-input py-0.5 pl-0.5 pr-1">
            <IonSearchbar
              className="app-searchbar-hero min-w-0 flex-1"
              value={query}
              debounce={0}
              placeholder="Search artists, friends, venues, songs…"
              enterkeyhint="search"
              onIonInput={(e) => handleInput(e.detail.value ?? '')}
              onIonFocus={() => query.trim().length >= 2 && setShowResults(true)}
            />
            <IonButton type="submit" className="app-hero-search-btn shrink-0" color="primary">
              Search
            </IonButton>
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
            sections={['artists', 'friends', 'venues', 'songs']}
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
