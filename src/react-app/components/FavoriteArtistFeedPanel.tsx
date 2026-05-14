import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Loader2, MapPin, Star, Ticket, Video } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { clipDisplayAspectRatio } from '@/react-app/utils/clipDisplayAspectRatio';
import { artistPath, venuePath } from '@/shared/app-paths';
import ClipModal from '@/react-app/components/ClipModal';

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
};

export default function FavoriteArtistFeedPanel({
  variant,
  scrollIntoViewOnMount = false,
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

  const fetchSlice = useCallback(
    async (offset: number, append: boolean) => {
      const res = await fetch(
        `/api/discover/favorite-artist-feed?events_limit=3&clips_limit=${clipsLimit}&clips_offset=${offset}`,
        { credentials: 'include', cache: 'no-store' },
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

  if (!user || isPending) return null;
  // Discover: avoid showing a loading shell that then vanishes when the user has no favorite artists.
  if (variant === 'discover' && (loading || !hasFavoriteArtists)) return null;
  if (variant !== 'discover' && !loading && !hasFavoriteArtists) return null;

  return (
    <>
      <section
        ref={sectionRef}
        id="favorite-artist-clips"
        className="mb-10 rounded-2xl border border-purple-500/25 bg-black/35 p-5 sm:p-6 backdrop-blur-lg"
      >
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Star className="w-6 h-6 text-purple-400 shrink-0" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">From artists you follow</h2>
        </div>

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
                  No clips yet from these artists — check back after the next show.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clips.map((clip, index) => (
                    <button
                      type="button"
                      key={clipListItemKey(clip, index)}
                      onClick={() => setSelectedClip(clip)}
                      className="text-left rounded-xl border border-momentum-teal/20 bg-black/40 overflow-hidden hover:border-momentum-mint/50 transition-all group"
                    >
                      <div
                        className="relative w-full bg-black"
                        style={{ aspectRatio: clipDisplayAspectRatio(clip) ?? '9 / 16' }}
                      >
                        <img
                          src={
                            clip.thumbnail_url ||
                            'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
                          }
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-3">
                        {clip.artist_name ? (
                          <div className="font-bold text-purple-300 text-sm truncate">{clip.artist_name}</div>
                        ) : null}
                        {clip.content_description ? (
                          <p className="text-gray-400 text-xs line-clamp-2 mt-1">{clip.content_description}</p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {variant === 'feed' && !loading && hasFavoriteArtists ? (
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

      {selectedClip ? <ClipModal clip={selectedClip} onClose={() => setSelectedClip(null)} /> : null}
    </>
  );
}
