import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Loader2, MapPin, Plus, Save, Star, Ticket, Video, X } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { artistPath, venuePath } from '@/shared/app-paths';
import ClipModal from '@/react-app/components/ClipModal';
import FavoriteArtistsJamBaseField from '@/react-app/components/FavoriteArtistsJamBaseField';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import {
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

type FavoriteFeedEvent = {
  artist_name?: string | null;
  artist_image?: string | null;
  venue_name?: string | null;
  venue_location?: string | null;
  date?: string | null;
  ticket_url?: string | null;
};

export type FavoriteArtistFeedPanelProps = {
  variant: 'feed' | 'discover';
  /** When true, scroll this block into view after data loads (e.g. `?from_favorites=1` on Discover). */
  scrollIntoViewOnMount?: boolean;
  /** Feed variant: show link to Discover for more clips (default true). Set false when already on Discover. */
  showExploreMore?: boolean;
  /** No card border; carousel bleeds to screen edge on mobile. */
  edgeBleed?: boolean;
  edgeBleedScope?: 'home' | 'page';
};

export default function FavoriteArtistFeedPanel({
  variant,
  scrollIntoViewOnMount = false,
  showExploreMore = true,
  edgeBleed = false,
  edgeBleedScope = 'page',
}: FavoriteArtistFeedPanelProps) {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const clipsLimit = variant === 'feed' ? 8 : 12;
  const nextClipOffsetRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<FavoriteFeedEvent[]>([]);
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
        `/api/discover/favorite-artist-feed?events_limit=3&clips_limit=${clipsLimit}&clips_offset=${offset}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('favorite-artist-feed');
      const data = (await res.json()) as {
        hasFavoriteArtists?: boolean;
        upcomingEvents?: FavoriteFeedEvent[];
        clips?: ClipWithUser[];
        hasMoreClips?: boolean;
      };

      if (!data.hasFavoriteArtists) {
        setHasFavoriteArtists(false);
        setUpcomingEvents([]);
        setClips([]);
        setHasMoreClips(false);
        nextClipOffsetRef.current = 0;
        return;
      }

      setHasFavoriteArtists(true);
      if (!append) {
        setUpcomingEvents(data.upcomingEvents ?? []);
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
          setUpcomingEvents([]);
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
    } catch (e) {
      setSaveArtistsError(apiFetchErrorMessage(e, 'Save failed'));
    } finally {
      setSavingArtists(false);
    }
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
            : 'mb-10 rounded-2xl border border-purple-500/25 bg-black/35 p-5 sm:p-6 backdrop-blur-lg'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Star className="w-6 h-6 text-purple-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">From artists you follow</h2>
          </div>
          {variant === 'feed' ? (
            <button
              type="button"
              onClick={() => {
                setShowAddArtists((open) => {
                  const next = !open;
                  if (next) {
                    setSaveArtistsError(null);
                    void loadSavedFavoriteNames();
                  }
                  return next;
                });
              }}
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-purple-500/50 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 hover:border-purple-400/60 transition-colors"
              title={showAddArtists ? 'Close manage artists' : 'Manage favorite artists'}
              aria-expanded={showAddArtists}
              aria-label={showAddArtists ? 'Close manage artists' : 'Manage favorite artists'}
            >
              {showAddArtists ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          ) : null}
        </div>

        {variant === 'feed' && showAddArtists ? (
          <div className="mb-8 rounded-xl border border-purple-500/30 bg-black/50 p-4 sm:p-5">
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

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-amber-400" />
                  Upcoming shows
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingEvents.slice(0, 3).map((ev, i) => {
                    const artist = ev.artist_name ?? 'Artist';
                    const venue = ev.venue_name;
                    const when = ev.date ? new Date(ev.date) : null;
                    return (
                      <div
                        key={`${artist}-${venue ?? ''}-${String(ev.date)}-${i}`}
                        className="rounded-xl border border-white/10 bg-black/40 p-4 flex flex-col gap-2"
                      >
                        <div className="flex gap-3">
                          {ev.artist_image ? (
                            <img
                              src={ev.artist_image}
                              alt=""
                              className="w-14 h-14 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-white/10 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => navigate(artistPath(artist))}
                              className="font-semibold text-white text-left hover:text-cyan-300 truncate block w-full"
                            >
                              {artist}
                            </button>
                            {venue ? (
                              <button
                                type="button"
                                onClick={() => navigate(venuePath(venue))}
                                className="text-sm text-gray-400 hover:text-cyan-200 flex items-start gap-1 text-left mt-0.5"
                              >
                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span className="truncate">{venue}</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {when && !Number.isNaN(when.getTime()) ? (
                          <div className="flex items-center gap-2 text-sm text-gray-300">
                            <Calendar className="w-4 h-4 shrink-0" />
                            {when.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        ) : null}
                        {typeof ev.ticket_url === 'string' && ev.ticket_url ? (
                          <a
                            href={ev.ticket_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto text-center text-sm font-medium py-2 rounded-lg momentum-grad-interactive text-white"
                          >
                            Tickets
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" />
                Clips from your favorites
              </h3>
              {clips.length === 0 ? (
                <p className="text-gray-400 text-sm py-4">
                  {hasFavoriteArtists
                    ? 'No clips yet from these artists — check back after the next show.'
                    : 'Tap + to add favorite artists and see their clips and tour picks here.'}
                </p>
              ) : (
                <HorizontalClipCarousel
                  ariaLabel="Clips from artists you follow"
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
                      <ClipFeedGridTile clip={clip} onOpenClip={setSelectedClip} />
                    </HorizontalClipCarouselItem>
                  ))}
                </HorizontalClipCarousel>
              )}

              {variant === 'feed' && showExploreMore && !loading && hasFavoriteArtists ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigate('/discover?from_favorites=1')}
                    className="px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white text-sm hover:scale-[1.02] transition-transform"
                  >
                    Explore more clips
                  </button>
                </div>
              ) : null}

              {variant === 'discover' && hasMoreClips ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={loadMoreClips}
                    className="px-6 py-3 rounded-xl font-semibold text-white text-sm border border-momentum-teal/40 bg-black/50 hover:bg-black/70 disabled:opacity-50 transition-colors"
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
          </>
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
