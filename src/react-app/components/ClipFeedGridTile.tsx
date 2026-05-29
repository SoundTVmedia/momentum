import { MapPin, Flame } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import ClipFeedPreviewMedia from '@/react-app/components/ClipFeedPreviewMedia';
import UserAvatar from '@/react-app/components/UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import { clipPostedAt, formatRelativeTime } from '@/react-app/lib/formatRelativeTime';
import { artistPath, songPath, venuePath } from '@/shared/app-paths';
import { songSlugFromTitle } from '@/shared/song-tag';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import {
  type ClipPlaybackFields,
  prefetchCarouselNeighborClips,
} from '@/shared/clip-playback';

export type ClipFeedGridTileProps = {
  clip: ClipWithUser;
  onOpenClip: (clip: ClipWithUser) => void;
  /** When set, hover prefetches adjacent carousel clips (feed MP4 + modal source). */
  neighborClips?: { next?: ClipPlaybackFields | null; prev?: ClipPlaybackFields | null };
};

export default function ClipFeedGridTile({
  clip,
  onOpenClip,
  neighborClips,
}: ClipFeedGridTileProps) {
  const navigate = useNavigate();
  const [mediaHovered, setMediaHovered] = useState(false);

  return (
    <div className="glass-clip-card group flex h-full w-full flex-col p-0">
      <div
        className="glass-clip-media-frame relative w-full cursor-pointer group/video overflow-hidden bg-black aspect-square rounded-[0.9rem]"
        onClick={() => onOpenClip(clip)}
        onMouseEnter={() => {
          setMediaHovered(true);
          if (neighborClips) prefetchCarouselNeighborClips(neighborClips);
        }}
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

        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center rounded-[inherit] opacity-0 transition-opacity group-hover/video:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:hidden">
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

        <div className="glass-clip-overlay-bottom absolute bottom-0 left-0 right-0 z-[3] flex flex-col gap-0.5 px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-2.5 md:py-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/users/${clip.mocha_user_id}`);
            }}
            className="flex items-center gap-1 min-w-0 max-w-full rounded-md bg-black/20 px-0.5 py-px backdrop-blur-sm transition-opacity hover:opacity-90"
          >
            <UserAvatar
              imageUrl={clip.user_avatar}
              displayName={clip.user_display_name}
              seed={clip.mocha_user_id}
              alt={clip.user_display_name || 'User'}
              sizeClass="w-5 h-5 sm:w-5 md:w-4 md:h-4"
              letterClassName="text-[8px] font-semibold"
              className="border border-white/25 shadow-sm shrink-0"
            />
            <span className="fb-clip-user min-w-0 truncate">
              {clip.user_display_name || 'Anonymous'}
            </span>
            <span className="fb-clip-meta-muted shrink-0 opacity-60" aria-hidden>
              ·
            </span>
            <span className="fb-clip-meta-muted shrink-0 truncate">
              {formatRelativeTime(clipPostedAt(clip))}
            </span>
          </button>

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
          {clip.song_title?.trim() && clip.artist_name ? (
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
          ) : null}
          {clip.venue_name || clip.location ? (
            <div className="fb-clip-place-row flex min-w-0 w-full items-center gap-1 overflow-hidden">
              <MapPin className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden />
              <p className="min-w-0 flex-1 truncate leading-none">
                {clip.venue_name ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(venuePath(clip.venue_name!));
                    }}
                    className="font-medium text-white/90 hover:text-white transition-colors"
                  >
                    {clip.venue_name}
                  </button>
                ) : null}
                {clip.venue_name && clip.location ? (
                  <span className="text-white/45"> · </span>
                ) : null}
                {clip.location ? (
                  <span className="text-white/70">{clip.location}</span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
