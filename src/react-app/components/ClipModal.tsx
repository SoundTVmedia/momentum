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
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useClipLike } from '@/react-app/hooks/useClipLike';
import { useClipSave } from '@/react-app/hooks/useClipSave';
import { useClipRating } from '@/react-app/hooks/useClipRating';
import { useFavoriteClip } from '@/react-app/hooks/useFavoriteClip';
import CommentSection from './CommentSection';
import StreamVideoPlayer from './StreamVideoPlayer';
import { clipDisplayAspectRatio } from '@/react-app/utils/clipDisplayAspectRatio';
import StarRating from './StarRating';
import UserAvatar from './UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import { artistPath, venuePath } from '@/shared/app-paths';
import { clipPostedAt, formatRelativeTime } from '@/react-app/lib/formatRelativeTime';

export type ClipModalFeedNavigation = {
  clips: ClipWithUser[];
  onChangeClip: (clip: ClipWithUser) => void;
};

interface ClipModalProps {
  clip: ClipWithUser;
  onClose: () => void;
  /** Desktop: chevron prev/next. Mobile: swipe up/down. Multiple clips only. */
  feedNavigation?: ClipModalFeedNavigation | null;
}

export default function ClipModal({ clip, onClose, feedNavigation = null }: ClipModalProps) {
  const navigate = useNavigate();
  const { toggleLike, isLiked } = useClipLike();
  const { toggleSave, isSaved } = useClipSave();
  const { rating, rateClip } = useClipRating(clip.id);
  const { isFavorited, toggleFavorite } = useFavoriteClip(clip.id);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [isLiking, setIsLiking] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const navIndex =
    feedNavigation && feedNavigation.clips.length > 0
      ? feedNavigation.clips.findIndex((c) => c.id === clip.id)
      : -1;
  const canFeedNav = navIndex >= 0 && feedNavigation != null && feedNavigation.clips.length > 1;
  const prevClip = canFeedNav && navIndex > 0 ? feedNavigation!.clips[navIndex - 1] : null;
  const nextClip =
    canFeedNav && navIndex < feedNavigation!.clips.length - 1 ? feedNavigation!.clips[navIndex + 1] : null;

  const goPrev = useCallback(() => {
    if (prevClip && feedNavigation) feedNavigation.onChangeClip(prevClip);
  }, [prevClip, feedNavigation]);

  const goNext = useCallback(() => {
    if (nextClip && feedNavigation) feedNavigation.onChangeClip(nextClip);
  }, [nextClip, feedNavigation]);

  useEffect(() => {
    setShowShareMenu(false);
    setLinkCopied(false);
  }, [clip.id]);

  useEffect(() => {
    if (!canFeedNav) return;
    const onKey = (e: KeyboardEvent) => {
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
  }, [canFeedNav, goPrev, goNext]);

  const SWIPE_MIN_PX = 56;

  const onSwipeTouchStart = (e: React.TouchEvent) => {
    if (!canFeedNav) return;
    const t = e.targetTouches[0];
    touchStartY.current = t.clientY;
    touchStartX.current = t.clientX;
  };

  const onSwipeTouchEnd = (e: React.TouchEvent) => {
    if (!canFeedNav || touchStartY.current == null) return;
    const t = e.changedTouches[0];
    const dy = touchStartY.current - t.clientY;
    const dx = (touchStartX.current ?? t.clientX) - t.clientX;
    touchStartY.current = null;
    touchStartX.current = null;
    if (Math.abs(dy) < SWIPE_MIN_PX) return;
    if (Math.abs(dy) < Math.abs(dx) * 1.15) return;
    if (dy > 0) goNext();
    else goPrev();
  };

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

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] bg-black/95 border-0 sm:border border-momentum-teal/20 sm:rounded-xl overflow-hidden animate-scale-in">
        <div className="flex flex-col md:flex-row h-full sm:max-h-[90vh]">
          {/* Video side */}
          <div className="md:w-2/3 bg-black flex items-center justify-center relative flex-shrink-0 min-h-[36vh] md:min-h-0 p-2 sm:p-4">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {prevClip && (
              <button
                type="button"
                onClick={goPrev}
                className="hidden md:flex absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/55 hover:bg-black/75 text-white border border-white/15 transition-colors"
                aria-label="Previous clip"
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            )}
            {nextClip && (
              <button
                type="button"
                onClick={goNext}
                className="hidden md:flex absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/55 hover:bg-black/75 text-white border border-white/15 transition-colors"
                aria-label="Next clip"
              >
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            )}

            <div
              className="relative w-full max-h-[min(85dvh,100%)] md:max-h-[min(90vh,72vw)] mx-auto bg-black rounded-none sm:rounded-lg overflow-hidden touch-pan-y"
              style={{
                aspectRatio: clipDisplayAspectRatio(clip) ?? '16 / 9',
              }}
              onTouchStart={onSwipeTouchStart}
              onTouchEnd={onSwipeTouchEnd}
            >
              <StreamVideoPlayer
                streamVideoId={(clip as any).stream_video_id}
                playbackUrl={(clip as any).stream_playback_url}
                fallbackUrl={clip.video_url}
                poster={(clip as any).stream_thumbnail_url || clip.thumbnail_url || undefined}
                autoPlay
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          {/* Content Side */}
          <div className="md:w-1/3 flex flex-col bg-slate-900/50 flex-1 overflow-hidden">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                  <UserAvatar
                    imageUrl={clip.user_avatar}
                    displayName={clip.user_display_name}
                    seed={clip.mocha_user_id}
                    alt={clip.user_display_name || 'User'}
                    sizeClass="w-8 h-8 sm:w-10 sm:h-10"
                    letterClassName="text-xs sm:text-sm font-semibold"
                    className="border-2 border-momentum-teal/40 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-white text-sm sm:text-base truncate">
                      {clip.user_display_name || 'Anonymous'}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">
                      {formatRelativeTime(clipPostedAt(clip))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Artist/Venue Info */}
              <div className="space-y-1.5 sm:space-y-2">
                {clip.artist_name && (
                  <button
                    onClick={() => {
                      onClose()
                      if (clip.artist_name) {
                        navigate(artistPath(clip.artist_name))
                      }
                    }}
                    className="flex items-center space-x-2 hover:opacity-80 transition-opacity min-w-0"
                  >
                    <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-white font-bold text-sm sm:text-base truncate">{clip.artist_name}</span>
                  </button>
                )}
                {clip.venue_name && (
                  <button
                    onClick={() => {
                      onClose()
                      if (clip.venue_name) {
                        navigate(venuePath(clip.venue_name))
                      }
                    }}
                    className="flex items-center space-x-2 hover:opacity-80 transition-opacity min-w-0"
                  >
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm sm:text-base truncate">{clip.venue_name}</span>
                  </button>
                )}
                {clip.location && (
                  <div className="flex items-center space-x-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm sm:text-base truncate">{clip.location}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {clip.content_description && (
                <p className="text-gray-200 mt-3 text-sm sm:text-base line-clamp-3 sm:line-clamp-none">{clip.content_description}</p>
              )}

              {/* Star Rating */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-sm text-gray-400 mb-2">Rate this moment</div>
                <StarRating
                  rating={rating}
                  averageRating={(clip as any).average_rating || 0}
                  ratingCount={(clip as any).rating_count || 0}
                  onRate={rateClip}
                  size="md"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <button
                    onClick={handleLike}
                    className={`flex items-center space-x-1.5 sm:space-x-2 transition-all tap-feedback ${
                      isLiked(clip.id) ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                      isLiked(clip.id) ? 'fill-current' : ''
                    } ${isLiking ? 'animate-heart-pop' : ''}`} />
                    <span className="font-medium text-sm sm:text-base">{clip.likes_count}</span>
                  </button>

                  <div className="flex items-center space-x-1.5 sm:space-x-2 text-gray-400">
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-medium text-sm sm:text-base">{clip.comments_count}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    onClick={handleSave}
                    className={`p-1.5 sm:p-2 transition-all tap-feedback ${
                      isSaved(clip.id) ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
                    }`}
                    title={isSaved(clip.id) ? 'Unsave' : 'Save'}
                  >
                    <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform hover:scale-110 ${isSaved(clip.id) ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={toggleFavorite}
                    className={`p-1.5 sm:p-2 transition-all tap-feedback ${
                      isFavorited ? 'text-pink-400' : 'text-gray-400 hover:text-pink-400'
                    }`}
                    title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    <Star className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform hover:scale-110 ${isFavorited ? 'fill-current' : ''}`} />
                  </button>

                  <div className="relative">
                    <button 
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-green-400 transition-colors"
                      title="Share"
                    >
                      <Share className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    {/* Share Menu */}
                    {showShareMenu && (
                      <div className="absolute right-0 bottom-full mb-2 bg-black/95 backdrop-blur-lg border border-momentum-teal/20 rounded-lg overflow-hidden shadow-xl z-10 min-w-[200px] animate-scale-in">
                        <button
                          onClick={handleCopyLink}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 hover:bg-white/10 transition-colors flex items-center space-x-2 sm:space-x-3 text-white whitespace-nowrap"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                              <span className="text-green-400 text-sm sm:text-base">Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span className="text-sm sm:text-base">Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleShareTwitter}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 hover:bg-white/10 transition-colors flex items-center space-x-2 sm:space-x-3 text-white border-t border-white/10 whitespace-nowrap"
                        >
                          <Twitter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                          <span className="text-sm sm:text-base">Twitter</span>
                        </button>
                        <button
                          onClick={handleShareFacebook}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 hover:bg-white/10 transition-colors flex items-center space-x-2 sm:space-x-3 text-white border-t border-white/10 whitespace-nowrap"
                        >
                          <Facebook className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                          <span className="text-sm sm:text-base">Facebook</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <CommentSection key={clip.id} clipId={clip.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
