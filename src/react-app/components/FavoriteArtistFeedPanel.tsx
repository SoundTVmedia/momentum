import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import ClipModal from '@/react-app/components/ClipModal';
import UnifiedFavoritesAdd from '@/react-app/components/UnifiedFavoritesAdd';
import FollowEmptySearch from '@/react-app/components/FollowEmptySearch';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import { filterViewerFeedClips } from '@/react-app/lib/clipPlaybackFailure';
import FeedFilters from '@/react-app/components/FeedFilters';
import PrePostClipsCarousel from '@/react-app/components/PrePostClipsCarousel';
import CarouselFeedFooter from '@/react-app/components/CarouselFeedFooter';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { useCarouselInfiniteLoad } from '@/react-app/hooks/useCarouselInfiniteLoad';
import { BROWSE_FAVORITE_CLIPS_PATH } from '@/react-app/lib/browse-paths';
import { apiFetch } from '@/react-app/lib/apiFetch';
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
import {
  USER_BLOCKS_CHANGED_EVENT,
  userBlocksChangedDetail,
} from '@/react-app/lib/user-block-events';

type FollowedVenue = { venue_id: number; name: string; clip_count?: number };

function followSwitcherChipClass(selected: boolean): string {
  return `inline-flex max-w-[14rem] items-center justify-center truncate rounded-xl border-2 px-4 py-2.5 text-sm font-semibold shadow-md transition-colors ${
    selected
      ? 'border-momentum-flare bg-momentum-flare/25 text-white'
      : 'border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20'
  }`;
}

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
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const clipsLimit = 12;
  const nextClipOffsetRef = useRef(0);

  const [panelView, setPanelView] = useState<FavoriteFeedFilterValue>('all');
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [hasMoreClips, setHasMoreClips] = useState(false);
  const [hasFavoriteArtists, setHasFavoriteArtists] = useState(false);
  const [hasFollows, setHasFollows] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showAddArtists, setShowAddArtists] = useState(false);
  const [followedVenues, setFollowedVenues] = useState<FollowedVenue[]>([]);
  const [followedFriendsCount, setFollowedFriendsCount] = useState(0);
  const [selectedVenueName, setSelectedVenueName] = useState('');
  const [savedSongs, setSavedSongs] = useState<{ slug: string; title: string }[]>([]);
  const [selectedSongSlug, setSelectedSongSlug] = useState('');
  const clipFeedScope = panelView === 'artists' ? 'artists' : 'all';

  const loadHubLists = useCallback(async () => {
    if (!user) return;
    try {
      const [venuesRes, songsRes, artistsRes] = await Promise.all([
        apiFetch('/api/users/me/following/list', { cache: 'no-store' }),
        apiFetch('/api/users/me/favorites?type=song', { cache: 'no-store' }),
        apiFetch('/api/users/me/favorite-artists', { cache: 'no-store' }),
      ]);
      if (venuesRes.ok) {
        const data = (await venuesRes.json()) as {
          venues?: FollowedVenue[];
          users?: { mocha_user_id?: string }[];
        };
        const next = (data.venues ?? []).filter((v) => v.name?.trim());
        setFollowedVenues(next);
        setFollowedFriendsCount((data.users ?? []).length);
        const preferred =
          next.find((v) => (v.clip_count ?? 0) > 0)?.name ?? next[0]?.name ?? '';
        setSelectedVenueName((current) =>
          current && next.some((v) => v.name === current) ? current : preferred,
        );
      }
      if (songsRes.ok) {
        const data = (await songsRes.json()) as {
          favorites?: { entity_key?: string; display_name?: string | null }[];
        };
        const next = (data.favorites ?? [])
          .map((row) => ({
            slug: (row.entity_key ?? '').trim(),
            title: (row.display_name ?? row.entity_key ?? '').trim(),
          }))
          .filter((row) => row.slug);
        setSavedSongs(next);
        setSelectedSongSlug((current) =>
          current && next.some((s) => s.slug === current) ? current : next[0]?.slug ?? '',
        );
      }
      // Favorite artists feed already hydrates clips; this keeps hasFavoriteArtists true
      // when the user only has profile JSON favorites and no clips yet.
      if (artistsRes.ok) {
        const data = (await artistsRes.json()) as { artists?: { name?: string }[] };
        if ((data.artists ?? []).some((a) => a.name?.trim())) {
          setHasFavoriteArtists(true);
        }
      }
    } catch {
      /* keep current lists */
    }
  }, [user]);

  const fetchSlice = useCallback(
    async (offset: number, append: boolean) => {
      const scope = clipFeedScope;
      const res = await apiFetch(
        `/api/discover/favorite-artist-feed?scope=${scope}&events_limit=0&clips_limit=${clipsLimit}&clips_offset=${offset}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        throw new Error('favorite-artist-feed');
      }
      const data = (await res.json()) as {
        hasFavoriteArtists?: boolean;
        hasFollows?: boolean;
        upcomingEvents?: unknown[];
        clips?: ClipWithUser[];
        hasMoreClips?: boolean;
      };

      setHasFavoriteArtists(Boolean(data.hasFavoriteArtists));
      setHasFollows(Boolean(data.hasFollows ?? data.hasFavoriteArtists));
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
    [clipsLimit, clipFeedScope],
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
          setHasFollows(false);
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
      void loadHubLists();
      void fetchSlice(0, false);
    };
    window.addEventListener('favorite-artists-changed', refresh);
    window.addEventListener('following-changed', refresh);
    return () => {
      window.removeEventListener('favorite-artists-changed', refresh);
      window.removeEventListener('following-changed', refresh);
    };
  }, [user, fetchSlice, loadHubLists]);

  useEffect(() => {
    if (!user) return;
    const onBlocksChanged = (event: Event) => {
      const detail = userBlocksChangedDetail(event);
      if (!detail) return;

      if (detail.blocked) {
        setClips((prev) =>
          prev.filter(
            (clip) => String(clip.mocha_user_id ?? '').trim().toLowerCase() !== detail.userId,
          ),
        );
        void fetchSlice(0, false);
      } else {
        void fetchSlice(0, false);
      }
    };

    window.addEventListener(USER_BLOCKS_CHANGED_EVENT, onBlocksChanged);
    return () => window.removeEventListener(USER_BLOCKS_CHANGED_EVENT, onBlocksChanged);
  }, [user, fetchSlice]);

  useEffect(() => {
    if (!scrollIntoViewOnMount || loading || !hasFollows) return;
    const id = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [scrollIntoViewOnMount, loading, hasFollows]);

  const loadMoreClips = useCallback(() => {
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
  }, [fetchSlice, hasMoreClips, loadingMore]);

  useCarouselInfiniteLoad({
    scrollRef: carouselScrollRef,
    sentinelRef: loadMoreSentinelRef,
    enabled: variant === 'feed' && (panelView === 'all' || panelView === 'artists') && clips.length > 0,
    hasMore: hasMoreClips,
    loading: loadingMore,
    onLoadMore: loadMoreClips,
    itemCount: clips.length,
  });

  const toggleAddArtists = () => {
    setShowAddArtists((open) => !open);
  };

  useEffect(() => {
    if (user) void loadHubLists();
  }, [user, loadHubLists]);

  if (!user || isPending) return null;
  // Discover: avoid showing a loading shell that then vanishes when the user follows nothing.
  if (variant === 'discover' && (loading || !hasFollows)) return null;

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
        <div className="flex flex-col items-start gap-2 text-left">
          {variant === 'feed' ? (
            <>
              <p className="text-sm text-gray-400">
                Follow Artists, Friends, Songs, and Venues for their latest content.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAddArtists}
                  className="inline-flex items-center gap-2 rounded-full border border-white bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 hover:border-white transition-colors"
                  title={showAddArtists ? 'Close follow' : 'Follow artists, friends, venues, songs, or shows'}
                  aria-expanded={showAddArtists}
                  aria-label={
                    showAddArtists
                      ? 'Close follow'
                      : 'Follow artists, friends, venues, songs, or shows'
                  }
                >
                  {showAddArtists ? (
                    <>
                      <span>Close</span>
                      <X className="w-4 h-4 shrink-0" aria-hidden />
                    </>
                  ) : (
                    <>
                      <span>Follow</span>
                      <Plus className="w-4 h-4 shrink-0" aria-hidden />
                    </>
                  )}
                </button>
                <FeedFilters
                  variant="menu"
                  options={FAVORITE_FEED_FILTER_OPTIONS}
                  currentFilter={panelView}
                  onFilterChange={setPanelView}
                />
              </div>
            </>
          ) : (
            <SectionHeading
              title="Your Favorites"
              subtitle="Clips and shows from artists, venues, and songs you follow."
              className="mb-0"
            />
          )}
        </div>

        {variant === 'feed' && showAddArtists ? (
          <div className="mb-6 mt-4 rounded-xl border border-momentum-rose/30 bg-black/50 p-4 sm:p-5">
            <UnifiedFavoritesAdd />
          </div>
        ) : null}

        {variant === 'feed' && panelView === 'venues' ? (
          <div className="mt-4 md:mt-5">
            {followedVenues.length === 0 ? (
              <FollowEmptySearch kind="venue" />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {followedVenues.map((venue) => (
                    <button
                      key={venue.venue_id || venue.name}
                      type="button"
                      onClick={() => setSelectedVenueName(venue.name)}
                      className={followSwitcherChipClass(selectedVenueName === venue.name)}
                    >
                      {venue.name}
                    </button>
                  ))}
                </div>
                {selectedVenueName ? (
                  <ConcertFeed
                    venueName={selectedVenueName}
                    hideSectionHeader
                    edgeBleed={edgeBleed}
                    edgeBleedScope={edgeBleedScope}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : variant === 'feed' && panelView === 'songs' ? (
          <div className="mt-4 md:mt-5">
            {savedSongs.length === 0 ? (
              <FollowEmptySearch kind="song" />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {savedSongs.map((song) => (
                    <button
                      key={song.slug}
                      type="button"
                      onClick={() => setSelectedSongSlug(song.slug)}
                      className={followSwitcherChipClass(selectedSongSlug === song.slug)}
                    >
                      {song.title}
                    </button>
                  ))}
                </div>
                {selectedSongSlug ? (
                  <ConcertFeed
                    songSlug={selectedSongSlug}
                    hideSectionHeader
                    edgeBleed={edgeBleed}
                    edgeBleedScope={edgeBleedScope}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : variant === 'feed' && panelView === 'friends' ? (
          <div className="mt-4 md:mt-5">
            {followedFriendsCount === 0 ? (
              <FollowEmptySearch kind="friend" />
            ) : (
              <PrePostClipsCarousel
                scope="friends"
                ariaLabel="Clips from people you follow"
                emptyMessage="No clips from people you follow yet."
                edgeBleed={edgeBleed}
                edgeBleedScope={edgeBleedScope}
                enableInfiniteScroll
              />
            )}
          </div>
        ) : variant === 'feed' && panelView === 'artists' && !loading && !hasFavoriteArtists ? (
          <div className="mt-4 md:mt-5">
            <FollowEmptySearch kind="artist" />
          </div>
        ) : loading ? (
          <div className="mt-4 md:mt-5 flex justify-center py-10">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : (
          <div className="mt-4 md:mt-5">
            {clips.length === 0 ? (
              <p className="text-gray-400 text-sm py-4">
                {hasFollows || hasFavoriteArtists
                  ? panelView === 'artists'
                    ? 'No clips yet from these artists — check back after the next show.'
                    : 'No clips yet from who you follow — check back after the next show.'
                  : 'Use Follow + to add artists, friends, songs, and venues — then their clips show up here.'}
              </p>
            ) : (
              <HorizontalClipCarousel
                ref={variant === 'feed' ? carouselScrollRef : undefined}
                ariaLabel={panelView === 'artists' ? 'Clips from your artists' : 'Clips from who you follow'}
                stretchItems
                className={
                  edgeBleed
                    ? edgeBleedScope === 'home'
                      ? HOME_FEED_CAROUSEL_BLEED
                      : PAGE_CAROUSEL_BLEED
                    : '-mx-5 px-5 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:pt-1 md:pb-2'
                }
                onReachEnd={() => {
                  if (variant === 'feed' && hasMoreClips && !loadingMore) loadMoreClips();
                }}
              >
                {filterViewerFeedClips(clips).map((clip, index, visible) => (
                  <HorizontalClipCarouselItem key={clipListItemKey(clip, index)}>
                    <ClipFeedGridTile
                      clip={clip}
                      onOpenClip={setSelectedClip}
                      neighborClips={{
                        prev: visible[index - 1],
                        next: visible[index + 1],
                      }}
                    />
                  </HorizontalClipCarouselItem>
                ))}
                {variant === 'feed' && hasMoreClips ? (
                  <div
                    ref={loadMoreSentinelRef}
                    className="flex-shrink-0 w-px h-px opacity-0 snap-none"
                    aria-hidden
                  />
                ) : null}
              </HorizontalClipCarousel>
            )}

            {clips.length > 0 ? (
              <CarouselFeedFooter
                loading={loadingMore}
                hasMore={hasMoreClips}
                viewAllHref={
                  variant === 'feed' || variant === 'discover'
                    ? BROWSE_FAVORITE_CLIPS_PATH
                    : undefined
                }
                viewAllLabel="View all clips"
                showEndMessage={variant !== 'feed' && variant !== 'discover'}
              />
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
