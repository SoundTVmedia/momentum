import {
  X,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  MapPin,
  Music,
  Calendar,
  Check,
  Copy,
  Facebook,
  Twitter,
  Star,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Radio,
  Pencil,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useClipLike } from '@/react-app/hooks/useClipLike';
import { useClipSave } from '@/react-app/hooks/useClipSave';
import { useClipRating } from '@/react-app/hooks/useClipRating';
import { useFavoriteClip } from '@/react-app/hooks/useFavoriteClip';
import { useHorizontalFeedSwipe } from '@/react-app/hooks/useHorizontalFeedSwipe';
import CommentSection from './CommentSection';
import ClipEditModal from './ClipEditModal';
import ClipModalMaximizedVideo from './ClipModalMaximizedVideo';
import { clipBelongsToUser } from '@/shared/mocha-user-id';
import StarRating from './StarRating';
import UserAvatar from './UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import { artistPath, genrePath, globalSongPath, songPath, venuePath } from '@/shared/app-paths';
import { genreSlugFromName } from '@/shared/genre-tag';
import { songSlugFromTitle } from '@/shared/song-tag';
import { clipPostedAt, formatRelativeTime } from '@/react-app/lib/formatRelativeTime';

export type ClipModalFeedNavigation = {
  clips: ClipWithUser[];
  onChangeClip: (clip: ClipWithUser) => void;
};

interface ClipModalProps {
  clip: ClipWithUser;
  onClose: () => void;
  /** Desktop: chevrons. Mobile: swipe left/right once to change clip. */
  feedNavigation?: ClipModalFeedNavigation | null;
  /** Called after the owner saves edits (e.g. refresh feed tiles). */
  onClipUpdated?: (clip: ClipWithUser) => void;
}

export default function ClipModal({
  clip,
  onClose,
  feedNavigation = null,
  onClipUpdated,
}: ClipModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggleLike, isLiked } = useClipLike();
  const { toggleSave, isSaved } = useClipSave();
  const { rating, rateClip } = useClipRating(clip.id);
  const { isFavorited, toggleFavorite } = useFavoriteClip(clip.id);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const isOwnClip = clipBelongsToUser(user?.id, clip.mocha_user_id);

  const navIndex =
    feedNavigation && feedNavigation.clips.length > 0
      ? feedNavigation.clips.findIndex((c) => c.id === clip.id)
      : -1;
  const canFeedNav = navIndex >= 0 && feedNavigation != null && feedNavigation.clips.length > 1;
  const prevClip = canFeedNav && navIndex > 0 ? feedNavigation!.clips[navIndex - 1] : null;
  const nextClip =
    canFeedNav && navIndex < feedNavigation!.clips.length - 1
      ? feedNavigation!.clips[navIndex + 1]
      : null;

  const goPrev = useCallback(() => {
    if (prevClip && feedNavigation) feedNavigation.onChangeClip(prevClip);
  }, [prevClip, feedNavigation]);

  const goNext = useCallback(() => {
    if (nextClip && feedNavigation) feedNavigation.onChangeClip(nextClip);
  }, [nextClip, feedNavigation]);

  const [mobileViewport, setMobileViewport] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const mobileSwipeEnabled = canFeedNav && mobileViewport && !mobileCommentsOpen;

  const { containerRef: mobileSwipeRef } = useHorizontalFeedSwipe({
    enabled: mobileSwipeEnabled,
    onPrev: goPrev,
    onNext: goNext,
  });

  useEffect(() => {
    setShowShareMenu(false);
    setLinkCopied(false);
    setMobileCommentsOpen(false);
    setEditOpen(false);
  }, [clip.id]);

  const handleClipSaved = useCallback(
    (updated: ClipWithUser) => {
      feedNavigation?.onChangeClip(updated);
      onClipUpdated?.(updated);
    },
    [feedNavigation, onClipUpdated],
  );

  const editClipButton = isOwnClip ? (
    <button
      type="button"
      onClick={() => setEditOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-momentum-teal/40 bg-momentum-teal/15 px-3 py-1.5 text-sm font-semibold text-momentum-mint transition-colors hover:bg-momentum-teal/25"
    >
      <Pencil className="h-4 w-4" />
      Edit clip
    </button>
  ) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!canFeedNav) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canFeedNav, goPrev, goNext, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleLike = async () => {
    setIsLiking(true);
    await toggleLike(clip.id, clip.likes_count);
    setTimeout(() => setIsLiking(false), 300);
  };

  const handleSave = async () => {
    await toggleSave(clip.id);
  };

  const getClipUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?clip=${clip.id}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getClipUrl());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareTwitter = () => {
    const text = `Check out this concert moment${clip.artist_name ? ` from ${clip.artist_name}` : ''}${clip.venue_name ? ` at ${clip.venue_name}` : ''} on FEEDBACK!`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getClipUrl())}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getClipUrl())}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const goArtist = () => {
    onClose();
    if (clip.artist_name) navigate(artistPath(clip.artist_name));
  };

  const goVenue = () => {
    onClose();
    if (clip.venue_name) navigate(venuePath(clip.venue_name));
  };

  const goSong = () => {
    onClose();
    const slug = clip.song_slug?.trim() || songSlugFromTitle(clip.song_title);
    if (!slug) return;
    if (clip.artist_name) navigate(songPath(clip.artist_name, slug));
    else navigate(globalSongPath(slug));
  };

  const goGenre = () => {
    onClose();
    const slug = clip.genre_slug?.trim() || genreSlugFromName(clip.genre_name);
    if (slug) navigate(genrePath(slug));
  };

  const mobileVideoOverlay = (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-3 pb-16 pt-3">
        <div className="pointer-events-auto flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              imageUrl={clip.user_avatar}
              displayName={clip.user_display_name}
              seed={clip.mocha_user_id}
              alt={clip.user_display_name || 'User'}
              sizeClass="w-9 h-9"
              letterClassName="text-xs font-semibold"
              className="border-2 border-white/30 shrink-0"
            />
            <div className="min-w-0">
              <p className="fb-clip-user truncate text-sm">
                {clip.user_display_name || 'Anonymous'}
              </p>
              <p className="text-xs text-white/70">
                {formatRelativeTime(clipPostedAt(clip))}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {editClipButton}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/50 p-2 text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-4 pt-20">
        <div className="pointer-events-auto pr-14">
          {clip.artist_name ? (
            <button type="button" onClick={goArtist} className="block max-w-full text-left">
              <p className="fb-clip-artist-name text-lg">{clip.artist_name}</p>
            </button>
          ) : null}
          {clip.venue_name ? (
            <button type="button" onClick={goVenue} className="mt-0.5 block max-w-full text-left">
              <p className="fb-clip-venue text-sm">{clip.venue_name}</p>
            </button>
          ) : null}
          {clip.content_description ? (
            <p className="fb-clip-caption mt-2">{clip.content_description}</p>
          ) : null}
          {canFeedNav ? (
            <p className="mt-2 text-[11px] uppercase tracking-wide text-white/45">
              Swipe left or right for next clip
            </p>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-20 right-2 z-20 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleLike}
          className={`pointer-events-auto flex flex-col items-center gap-0.5 ${
            isLiked(clip.id) ? 'text-red-400' : 'text-white'
          }`}
        >
          <Heart
            className={`h-7 w-7 ${isLiked(clip.id) ? 'fill-current' : ''} ${
              isLiking ? 'animate-heart-pop' : ''
            }`}
          />
          <span className="text-xs font-medium">{clip.likes_count}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileCommentsOpen(true)}
          className="pointer-events-auto flex flex-col items-center gap-0.5 text-white"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="text-xs font-medium">{clip.comments_count}</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={`pointer-events-auto ${
            isSaved(clip.id) ? 'text-yellow-400' : 'text-white'
          }`}
        >
          <Bookmark className={`h-7 w-7 ${isSaved(clip.id) ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          className={`pointer-events-auto ${
            isFavorited ? 'text-pink-400' : 'text-white'
          }`}
        >
          <Star className={`h-7 w-7 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="text-white"
          >
            <Share className="h-7 w-7" />
          </button>
          {showShareMenu ? (
            <div className="absolute bottom-full right-0 mb-2 min-w-[180px] overflow-hidden rounded-lg border border-white/15 bg-black/95 shadow-xl">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-white/10"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy link</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleShareTwitter}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/10"
              >
                <Twitter className="h-4 w-4 text-blue-400" />
                <span>Twitter</span>
              </button>
              <button
                type="button"
                onClick={handleShareFacebook}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/10"
              >
                <Facebook className="h-4 w-4 text-blue-600" />
                <span>Facebook</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in bg-black/90 backdrop-blur-sm">
      {/* ——— Mobile: full-viewport video + overlays ——— */}
      <div
        ref={mobileSwipeRef}
        className={`relative flex h-[100dvh] w-full flex-col md:hidden overscroll-none ${
          mobileSwipeEnabled ? 'touch-none' : ''
        }`}
      >
        <div className="relative min-h-0 flex-1">
          <ClipModalMaximizedVideo clip={clip} overlay={mobileVideoOverlay} />
        </div>

        {mobileCommentsOpen ? (
          <div
            className="absolute inset-0 z-30 flex flex-col bg-black/60"
            role="dialog"
            aria-label="Comments"
          >
            <button
              type="button"
              className="flex-1"
              aria-label="Close comments"
              onClick={() => setMobileCommentsOpen(false)}
            />
            <div className="flex max-h-[58dvh] min-h-[40dvh] flex-col rounded-t-2xl border-t border-white/10 bg-slate-950/98">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="font-semibold text-white">Comments</span>
                <button
                  type="button"
                  onClick={() => setMobileCommentsOpen(false)}
                  className="rounded-full p-1.5 text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-4">
                <CommentSection key={clip.id} clipId={clip.id} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ——— Desktop ——— */}
      <div className="mx-auto hidden h-full w-full max-w-6xl items-center justify-center p-4 md:flex">
        <div className="flex h-full max-h-[90vh] w-full overflow-hidden rounded-xl border border-momentum-teal/20 bg-black/95 animate-scale-in">
          <div className="relative flex min-h-0 w-2/3 flex-shrink-0 items-center justify-center bg-black p-4">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>

            {prevClip ? (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-3 text-white transition-colors hover:bg-black/75"
                aria-label="Previous clip"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
            ) : null}
            {nextClip ? (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-3 text-white transition-colors hover:bg-black/75"
                aria-label="Next clip"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            ) : null}

            <div className="relative h-full w-full min-h-0">
              <ClipModalMaximizedVideo clip={clip} />
            </div>
          </div>

          <div className="flex w-1/3 flex-col overflow-hidden bg-slate-900/50">
            <div className="flex-shrink-0 border-b border-white/10 p-4">
              {isOwnClip ? <div className="mb-3 flex justify-end">{editClipButton}</div> : null}
              <div className="mb-3 flex items-center space-x-3">
                <UserAvatar
                  imageUrl={clip.user_avatar}
                  displayName={clip.user_display_name}
                  seed={clip.mocha_user_id}
                  alt={clip.user_display_name || 'User'}
                  sizeClass="w-10 h-10"
                  letterClassName="text-sm font-semibold"
                  className="border-2 border-momentum-teal/40 flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-white">
                    {clip.user_display_name || 'Anonymous'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatRelativeTime(clipPostedAt(clip))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {clip.artist_name ? (
                  <button
                    type="button"
                    onClick={goArtist}
                    className="flex min-w-0 items-center space-x-2 transition-opacity hover:opacity-80"
                  >
                    <Music className="h-4 w-4 shrink-0 text-purple-400" />
                    <span className="truncate text-base font-bold text-white">{clip.artist_name}</span>
                  </button>
                ) : null}
                {clip.song_title?.trim() ? (
                  <button
                    type="button"
                    onClick={goSong}
                    className="flex min-w-0 items-center space-x-2 text-left transition-opacity hover:opacity-80"
                  >
                    <Disc3 className="h-4 w-4 shrink-0 text-fuchsia-400" />
                    <span className="truncate text-base font-semibold text-fuchsia-200">
                      {clip.song_title}
                    </span>
                  </button>
                ) : null}
                {clip.genre_name?.trim() ? (
                  <button
                    type="button"
                    onClick={goGenre}
                    className="flex min-w-0 items-center space-x-2 text-left transition-opacity hover:opacity-80"
                  >
                    <Radio className="h-4 w-4 shrink-0 text-momentum-mint" />
                    <span className="truncate text-base font-medium text-momentum-mint/90">
                      {clip.genre_name}
                    </span>
                  </button>
                ) : null}
                {clip.venue_name ? (
                  <button
                    type="button"
                    onClick={goVenue}
                    className="flex min-w-0 items-center space-x-2 transition-opacity hover:opacity-80"
                  >
                    <Calendar className="h-4 w-4 shrink-0 text-blue-400" />
                    <span className="truncate text-base text-gray-300">{clip.venue_name}</span>
                  </button>
                ) : null}
                {clip.location ? (
                  <div className="flex min-w-0 items-center space-x-2">
                    <MapPin className="h-4 w-4 shrink-0 text-green-400" />
                    <span className="truncate text-base text-gray-300">{clip.location}</span>
                  </div>
                ) : null}
              </div>

              {clip.content_description ? (
                <p className="mt-3 text-base text-gray-200">{clip.content_description}</p>
              ) : null}

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="mb-2 text-sm text-gray-400">Rate this moment</div>
                <StarRating
                  rating={rating}
                  averageRating={(clip as { average_rating?: number }).average_rating || 0}
                  ratingCount={(clip as { rating_count?: number }).rating_count || 0}
                  onRate={rateClip}
                  size="md"
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={handleLike}
                    className={`flex items-center space-x-2 transition-all tap-feedback ${
                      isLiked(clip.id) ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <Heart
                      className={`h-5 w-5 transition-transform ${
                        isLiked(clip.id) ? 'fill-current' : ''
                      } ${isLiking ? 'animate-heart-pop' : ''}`}
                    />
                    <span className="text-base font-medium">{clip.likes_count}</span>
                  </button>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-base font-medium">{clip.comments_count}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    className={`p-2 transition-all tap-feedback ${
                      isSaved(clip.id) ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
                    }`}
                    title={isSaved(clip.id) ? 'Unsave' : 'Save'}
                  >
                    <Bookmark
                      className={`h-5 w-5 ${isSaved(clip.id) ? 'fill-current' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    className={`p-2 transition-all tap-feedback ${
                      isFavorited ? 'text-pink-400' : 'text-gray-400 hover:text-pink-400'
                    }`}
                    title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    <Star className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="p-2 text-gray-400 transition-colors hover:text-green-400"
                      title="Share"
                    >
                      <Share className="h-5 w-5" />
                    </button>
                    {showShareMenu ? (
                      <div className="absolute bottom-full right-0 z-10 mb-2 min-w-[200px] animate-scale-in overflow-hidden rounded-lg border border-momentum-teal/20 bg-black/95 shadow-xl">
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="flex w-full items-center space-x-3 whitespace-nowrap px-4 py-3 text-white transition-colors hover:bg-white/10"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="h-5 w-5 text-green-400" />
                              <span className="text-green-400">Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-5 w-5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleShareTwitter}
                          className="flex w-full items-center space-x-3 border-t border-white/10 whitespace-nowrap px-4 py-3 text-white transition-colors hover:bg-white/10"
                        >
                          <Twitter className="h-5 w-5 text-blue-400" />
                          <span>Twitter</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleShareFacebook}
                          className="flex w-full items-center space-x-3 border-t border-white/10 whitespace-nowrap px-4 py-3 text-white transition-colors hover:bg-white/10"
                        >
                          <Facebook className="h-5 w-5 text-blue-600" />
                          <span>Facebook</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <CommentSection key={clip.id} clipId={clip.id} />
            </div>
          </div>
        </div>
      </div>

      {editOpen ? (
        <ClipEditModal
          clip={clip}
          onClose={() => setEditOpen(false)}
          onSaved={handleClipSaved}
        />
      ) : null}
    </div>
  );
}
