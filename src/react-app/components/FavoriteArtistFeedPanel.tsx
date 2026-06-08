import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import ClipModal from '@/react-app/components/ClipModal';
import FavoriteArtistsJamBaseField from '@/react-app/components/FavoriteArtistsJamBaseField';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import FeedFilters from '@/react-app/components/FeedFilters';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import SectionHeading from '@/react-app/components/SectionHeading';
import {
  FAVORITE_FEED_FILTER_OPTIONS,
  type FavoriteFeedFilterValue,
} from '@/react-app/lib/favoriteFeedFilterMeta';
import {
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

export type FavoriteArtistFeedPanelProps = {
  variant: 'feed' | 'discover';
  /** When true, scroll this block into view after data loads (e.g. `?from_favorites=1` on Discover). */
  scrollIntoViewOnMount?: boolean;
  /** No card border; carousel bleeds to screen edge on mobile. */
  edgeBleed?: boolean;
  edgeBleedScope?: 'home' | 'page';
};

export default function FavoriteArtistFeedPanel({
  variant,
  scrollIntoViewOnMount = false,
  edgeBleed = false,
  edgeBleedScope = 'page',
}: FavoriteArtistFeedPanelProps) {
  const { user, isPending } = useAuth();
  const sectionRef = useRef<HTMLElement>(null);
  const clipsLimit = variant === 'feed' ? 8 : 12;
  const nextClipOffsetRef = useRef(0);

  const [panelView, setPanelView] = useState<FavoriteFeedFilterValue>('artists');
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [hasMoreClips, setHasMoreClips] = useState(false);
  const [hasFavoriteArtists, setHasFavoriteArtists] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showAddArtists, setShowAddArtists] = useState(false);
  const [draftFavoriteNames, setDraftFavoriteNames] = useState<string[]>([]);
  const [savingArtists, setSavingArtists] = useState(false);
  const [saveArtistsError, setSaveArtistsError] = useState<string | null>(null);
  const [loadingSavedArtists, setLoadingSavedArtists] = useState(false);

  const loadSavedFavoriteNames = useCallback(async () => {
    if (!user) return;
    setLoadingSavedArtists(true);
    try {
      const names = new Set<string>();
      const [favRes, meRes] = await Promise.all([
        apiFetch('/api/users/me/favorite-artists', { cache: 'no-store' }),
        apiFetch('/api/users/me', { cache: 'no-store' }),
      ]);

      if (favRes.ok) {
        const data = (await favRes.json()) as { artists?: { name?: string | null }[] };
        for (const a of data.artists ?? []) {
          const n = typeof a.name === 'string' ? a.name.trim() : '';
          if (n) names.add(n);
        }
      }

      if (meRes.ok) {
        const me = (await meRes.json()) as {
          profile?: { favorite_artists?: string | null } | null;
        } | null;
        const json = me?.profile?.favorite_artists;
        if (json) {
          try {
            const parsed = JSON.parse(json) as unknown;
            if (Array.isArray(parsed)) {
              for (const x of parsed) {
                const n = typeof x === 'string' ? x.trim() : String(x ?? '').trim();
                if (n) names.add(n);
              }
            }
          } catch {
            /* ignore bad JSON */
          }
        }
      }

      setDraftFavoriteNames([...names]);
    } catch {
      /* keep current draft */
    } finally {
      setLoadingSavedArtists(false);
    }
  }, [user]);

  const fetchSlice = useCallback(
    async (offset: number, append: boolean) => {
      const res = await apiFetch(
        `/api/discover/favorite-artist-feed?events_limit=0&clips_limit=${clipsLimit}&clips_offset=${offset}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('favorite-artist-feed');
      const data = (await res.json()) as {
        hasFavoriteArtists?: boolean;
        upcomingEvents?: unknown[];
        clips?: ClipWithUser[];
        hasMoreClips?: boolean;
      };

      if (!data.hasFavoriteArtists) {
        setHasFavoriteArtists(false);
        setClips([]);
        setHasMoreClips(false);
        nextClipOffsetRef.current = 0;
        return;
      }

      setHasFavoriteArtists(true);
      if (!append) {
        setClips(data.clips ?? []);
        nextClipOffsetRef.current = (data.clips ?? []).length;
      } else {
        setClips((prev) => {
          const next = [...prev, ...(data.clips ?? [])];
          nextClipOffsetRef.current = next.length;
          return next;
        });
      }
      setHasMoreClips(Boolean(data.hasMoreClips));
    },
    [clipsLimit],
  );

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await fetchSlice(0, false);
      } catch {
        if (!cancelled) {
          setHasFavoriteArtists(false);
          setClips([]);
          setHasMoreClips(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPending, fetchSlice]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      void loadSavedFavoriteNames();
      void fetchSlice(0, false);
    };
    window.addEventListener('favorite-artists-changed', refresh);
    return () => window.removeEventListener('favorite-artists-changed', refresh);
  }, [user, fetchSlice, loadSavedFavoriteNames]);

  useEffect(() => {
    if (!scrollIntoViewOnMount || loading || !hasFavoriteArtists) return;
    const id = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [scrollIntoViewOnMount, loading, hasFavoriteArtists]);

  const loadMoreClips = () => {
    if (!hasMoreClips || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        await fetchSlice(nextClipOffsetRef.current, true);
      } catch {
        /* ignore */
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  const saveFavoriteArtists = async () => {
    setSavingArtists(true);
    setSaveArtistsError(null);
    try {
      const res = await apiFetch('/api/personalization/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite_artists: draftFavoriteNames,
          personalization_enabled: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(body.detail || body.error || 'Could not save artists');
      }
      await loadSavedFavoriteNames();
      await fetchSlice(0, false);
      setShowAddArtists(false);
      window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    } catch (e) {
      setSaveArtistsError(apiFetchErrorMessage(e, 'Save failed'));
    } finally {
      setSavingArtists(false);
    }
  };

  const toggleAddArtists = () => {
    setShowAddArtists((open) => {
      const next = !open;
      if (next) {
        setSaveArtistsError(null);
        void loadSavedFavoriteNames();
      }
      return next;
    });
  };

  if (!user || isPending) return null;
  // Discover: avoid showing a loading shell that then vanishes when the user has no favorite artists.
  if (variant === 'discover' && (loading || !hasFavoriteArtists)) return null;

  return (
    <>
      <section
        ref={sectionRef}
        id="favorite-artist-clips"
        className={
          edgeBleed
            ? HOME_FEED_SECTION_CLASS
            : 'mb-8 rounded-2xl border border-momentum-rose/25 bg-black/35 p-5 sm:p-6 backdrop-blur-lg'
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SectionHeading
              title="Clips and Shows From Your Favorite Artists"
              className="mb-0"
            />
          </div>
          {variant === 'feed' ? (
            <button
              type="button"
              onClick={toggleAddArtists}
              className="shrink-0 inline-flex items-center gap-2 rounded-full border border-momentum-rose/50 bg-momentum-rose/15 px-3 py-2 text-momentum-flare/80 hover:bg-momentum-rose/25 hover:border-momentum-rose/60 transition-colors"
              title={showAddArtists ? 'Close manage artists' : 'Add favorite artists'}
              aria-expanded={showAddArtists}
              aria-label={
                showAddArtists ? 'Close manage artists' : 'Click to add favorite artists'
              }
            >
              {showAddArtists ? (
                <>
                  <span className="text-xs sm:text-sm font-medium text-momentum-flare/90">
                    Close
                  </span>
                  <X className="w-5 h-5 shrink-0" aria-hidden />
                </>
              ) : (
                <>
                  <span className="text-xs sm:text-sm font-medium text-momentum-flare/90 whitespace-nowrap">
                    Click to Add Artists
                  </span>
                  <Plus className="w-5 h-5 shrink-0" aria-hidden />
                </>
              )}
            </button>
          ) : null}
        </div>

        {variant === 'feed' && showAddArtists ? (
          <div className="mb-6 rounded-xl border border-momentum-rose/30 bg-black/50 p-4 sm:p-5">
            {loadingSavedArtists ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your favorites…
              </div>
            ) : (
              <FavoriteArtistsJamBaseField
                favoriteArtists={draftFavoriteNames}
                setFavoriteArtists={setDraftFavoriteNames}
                labelExtra={
                  <span className="text-gray-400 text-sm ml-2 font-normal block sm:inline mt-1 sm:mt-0">
                    Same list as profile → Home feed personalization
                  </span>
                }
                savedListLabel="Your favorites"
              />
            )}
            {saveArtistsError ? <p className="text-red-400 text-sm mt-3">{saveArtistsError}</p> : null}
            <div className="mt-4">
              <button
                type="button"
                disabled={savingArtists || loadingSavedArtists}
                onClick={() => void saveFavoriteArtists()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 momentum-grad-interactive rounded-lg font-semibold text-white text-sm hover:scale-[1.02] transition-transform disabled:opacity-45 disabled:hover:scale-100"
              >
                {savingArtists ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save artists
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {variant === 'feed' ? (
          <div className="mt-3 md:mt-4">
            <FeedFilters
              options={FAVORITE_FEED_FILTER_OPTIONS}
              currentFilter={panelView}
              onFilterChange={setPanelView}
            />
          </div>
        ) : null}

        {variant === 'feed' && panelView === 'upcoming' ? (
          <div className="mt-4 md:mt-5">
            <PersonalizedConcerts
              carouselBleedScope={edgeBleedScope}
              mode="favorite-artists"
              hideHeader
            />
          </div>
        ) : loading ? (
          <div className="mt-4 md:mt-5 flex justify-center py-10">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : (
          <div className="mt-4 md:mt-5">
            {clips.length === 0 ? (
              <p className="text-gray-400 text-sm py-4">
                {hasFavoriteArtists
                  ? 'No clips yet from these artists — check back after the next show.'
                  : 'Add favorite artists to see their clips and tour picks here.'}
              </p>
            ) : (
              <HorizontalClipCarousel
                ariaLabel="Clips from your artists"
                stretchItems
                className={
                  edgeBleed
                    ? edgeBleedScope === 'home'
                      ? HOME_FEED_CAROUSEL_BLEED
                      : PAGE_CAROUSEL_BLEED
                    : '-mx-5 px-5 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:pt-1 md:pb-2'
                }
              >
                {clips.map((clip, index) => (
                  <HorizontalClipCarouselItem key={clipListItemKey(clip, index)}>
                    <ClipFeedGridTile
                      clip={clip}
                      onOpenClip={setSelectedClip}
                      neighborClips={{
                        prev: clips[index - 1],
                        next: clips[index + 1],
                      }}
                    />
                  </HorizontalClipCarouselItem>
                ))}
              </HorizontalClipCarousel>
            )}

            {variant === 'discover' && hasMoreClips ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={loadMoreClips}
                  className="px-6 py-3 rounded-xl font-semibold text-white text-sm border border-momentum-ember/40 bg-black/50 hover:bg-black/70 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    'Load more clips'
                  )}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {selectedClip ? (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          feedNavigation={
            clips.length > 1
              ? { clips, onChangeClip: setSelectedClip }
              : null
          }
        />
      ) : null}
    </>
  );
}
