import { MessageCircle, Share, MapPin, Clock, Bookmark, Flame } from 'lucide-react';
import { ClipLikeHeart } from '@/react-app/components/ClipLikeHeart';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useClipLike } from '@/react-app/hooks/useClipLike';
import { useClipSave } from '@/react-app/hooks/useClipSave';
import ClipFeedPreviewMedia from '@/react-app/components/ClipFeedPreviewMedia';
import UserAvatar from '@/react-app/components/UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import { clipPostedAt, formatRelativeTime } from '@/react-app/lib/formatRelativeTime';
import { artistPath, songPath } from '@/shared/app-paths';
import { songSlugFromTitle } from '@/shared/song-tag';
import { clipShareUrl } from '@/shared/clip-share';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
export type ClipFeedGridTileProps = {
  clip: ClipWithUser;
  onOpenClip: (clip: ClipWithUser) => void;
};

export default function ClipFeedGridTile({ clip, onOpenClip }: ClipFeedGridTileProps) {
  const navigate = useNavigate();
  const { toggleLike, isLiked } = useClipLike();
  const { toggleSave, isSaved } = useClipSave();
  const [likingClip, setLikingClip] = useState<number | null>(null);
  const [mediaHovered, setMediaHovered] = useState(false);

  const handleLike = async (clipId: number, currentCount: number) => {
    setLikingClip(clipId);
    await toggleLike(clipId, currentCount);
    setTimeout(() => setLikingClip(null), 300);
  };

  const handleShare = async (clipId: number) => {
    const clipUrl = clipShareUrl(clipId);
    const shareText = `Check out this moment${clip.artist_name ? ` from ${clip.artist_name}` : ''}${clip.venue_name ? ` at ${clip.venue_name}` : ''} on FEEDBACK!`;

    try {
      await fetch(`/api/clips/${clipId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform:
            typeof navigator !== 'undefined' &&
            typeof (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share ===
              'function'
              ? 'native_share'
              : 'copy_link',
        }),
      });
    } catch (err) {
      console.error('Failed to track share:', err);
    }

    if (
      typeof navigator !== 'undefined' &&
      typeof (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share === 'function'
    ) {
      try {
        await navigator.share({
          title: 'Check out this FEEDBACK clip!',
          text: shareText,
          url: clipUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(clipUrl);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  return (
    <div className="glass-clip-card group flex h-full w-full flex-col p-0">
      <div
        className="glass-clip-media-frame relative w-full cursor-pointer group/video overflow-hidden bg-black aspect-square rounded-t-[0.9rem]"
        onClick={() => onOpenClip(clip)}
        onMouseEnter={() => setMediaHovered(true)}
        onMouseLeave={() => setMediaHovered(false)}
      >
        <ClipFeedPreviewMedia
          className="z-0"
          stream_video_id={clip.stream_video_id}
          stream_playback_url={clip.stream_playback_url}
          stream_thumbnail_url={clip.stream_thumbnail_url}
          video_url={clip.video_url}
          thumbnail_url={clip.thumbnail_url}
          mediaHovered={mediaHovered}
          previewInstanceKey={String(clipNumericId(clip) ?? clip.video_url ?? '')}
        />

        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center rounded-t-2xl opacity-0 transition-opacity group-hover/video:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:hidden">
          <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-10 md:h-10 lg:w-14 lg:h-14 bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember rounded-full flex items-center justify-center shadow-2xl animate-neon-pulse">
            <div className="w-0 h-0 border-l-[18px] sm:border-l-[22px] md:border-l-[16px] border-l-white border-y-[12px] sm:border-y-[14px] md:border-y-[11px] border-y-transparent ml-0.5 sm:ml-1" />
          </div>
        </div>

        {clip.is_trending_score != null && clip.is_trending_score >= 100 && (
          <div className="absolute top-2 right-2 md:top-1.5 md:right-1.5 z-10" title="Trending">
            <div
              className="bg-gradient-to-r from-momentum-ember to-momentum-flare text-white w-8 h-8 md:w-7 md:h-7 rounded-full shadow-lg flex items-center justify-center animate-slide-up"
              aria-label="Trending"
            >
              <Flame className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" strokeWidth={2} />
            </div>
          </div>
        )}

        {clip.momentum_live_featured && (
          <div className="absolute top-2 left-2 md:top-1.5 md:left-1.5 px-2 py-0.5 md:px-1.5 md:py-0.5 momentum-grad-interactive rounded-full text-[10px] md:text-[10px] font-bold text-white shadow-lg animate-slide-up">
            🎬 Featured on Feedback Live
          </div>
        )}

        <div className="glass-clip-overlay-top absolute top-0 left-0 right-0 z-[3] p-2 sm:p-3 md:p-1.5 lg:p-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/users/${clip.mocha_user_id}`);
            }}
            className="flex items-center space-x-1.5 sm:space-x-2 rounded-lg bg-black/25 px-1 py-0.5 backdrop-blur-md transition-opacity hover:opacity-90"
          >
            <UserAvatar
              imageUrl={clip.user_avatar}
              displayName={clip.user_display_name}
              seed={clip.mocha_user_id}
              alt={clip.user_display_name || 'User'}
              sizeClass="w-8 h-8 sm:w-9 sm:h-9 md:w-6 md:h-6 lg:w-8 lg:h-8"
              letterClassName="text-[10px] sm:text-xs font-semibold"
              className="border-2 border-white/30 shadow-lg"
            />
            <div className="min-w-0">
              <div className="fb-clip-user truncate">
                {clip.user_display_name || 'Anonymous'}
              </div>
              <div className="flex items-center space-x-1 fb-clip-meta-muted">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                <span className="truncate">{formatRelativeTime(clipPostedAt(clip))}</span>
              </div>
            </div>
          </button>
        </div>

        <div className="glass-clip-overlay-bottom absolute bottom-0 left-0 right-0 z-[3] p-2 sm:p-3 md:p-1.5 lg:p-3 space-y-1 md:space-y-0.5 lg:space-y-1">
          {clip.artist_name && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(artistPath(clip.artist_name));
              }}
              className="fb-clip-artist-name"
            >
              {clip.artist_name}
            </button>
          )}
          {clip.song_title?.trim() && clip.artist_name && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const slug = clip.song_slug?.trim() || songSlugFromTitle(clip.song_title);
                if (slug) navigate(songPath(clip.artist_name, slug));
              }}
              className="fb-clip-song"
            >
              ♪ {clip.song_title}
            </button>
          )}
          {clip.venue_name && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenClip(clip);
              }}
              className="fb-clip-venue"
            >
              <MapPin className="w-3 h-3 md:w-2.5 md:h-2.5 flex-shrink-0" />
              <span className="font-medium truncate">{clip.venue_name}</span>
              {clip.location ? (
                <span className="text-white/70 truncate hidden sm:inline">• {clip.location}</span>
              ) : null}
            </button>
          )}
          {clip.content_description ? (
            <p className="fb-clip-caption">
              {clip.content_description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="glass-clip-actions flex items-center justify-between rounded-b-[0.9rem] px-2 py-2 sm:px-3 sm:py-3 md:px-2 md:py-2 lg:px-3 lg:py-3">
        <div className="flex items-center justify-between w-full gap-1 sm:gap-2 md:gap-1 lg:gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleLike(clip.id, clip.likes_count);
            }}
            className={`flex flex-col items-center space-y-0.5 transition-all group tap-feedback flex-1 min-w-0 ${
              isLiked(clip.id) ? 'text-pink-500' : 'text-white hover:text-pink-400'
            }`}
          >
            <ClipLikeHeart
              liked={isLiked(clip.id)}
              className={`group-hover:scale-110 transition-transform ${
                isLiked(clip.id) ? '' : 'text-white hover:text-pink-400'
              } ${likingClip === clip.id ? 'animate-heart-pop' : ''}`}
            />
            <span className="font-bold text-[10px] sm:text-xs">{clip.likes_count}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenClip(clip);
            }}
            className="flex flex-col items-center space-y-0.5 text-white hover:text-momentum-flare transition-all group tap-feedback flex-1 min-w-0"
          >
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-[10px] sm:text-xs">{clip.comments_count}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleShare(clip.id);
            }}
            className="flex flex-col items-center space-y-0.5 text-white hover:text-momentum-rose transition-all group tap-feedback flex-1 min-w-0"
          >
            <Share className="w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-[10px] sm:text-xs">Share</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleSave(clip.id);
            }}
            className={`flex flex-col items-center space-y-0.5 transition-all group tap-feedback flex-1 min-w-0 ${
              isSaved(clip.id) ? 'text-momentum-ember' : 'text-white hover:text-momentum-ember'
            }`}
          >
            <Bookmark
              className={`w-5 h-5 sm:w-6 sm:h-6 md:w-4 md:h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform ${
                isSaved(clip.id) ? 'fill-current' : ''
              }`}
            />
            <span className="font-bold text-[10px] sm:text-xs">Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}
