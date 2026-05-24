import { Loader2, RefreshCw, Trash2, Heart, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import ClipModal from '@/react-app/components/ClipModal';
import ClipFeedGridTile from '@/react-app/components/ClipFeedGridTile';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

export type DashboardGridClip = Record<string, unknown> & {
  id?: unknown;
  thumbnail_url?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  location?: string | null;
  likes_count?: number;
  views_count?: number;
  artist_score?: number;
  location_score?: number;
  stream_thumbnail_url?: string | null;
  stream_playback_url?: string | null;
  stream_video_id?: string | null;
  video_url?: string | null;
  recording_orientation?: string | null;
  video_resolution_w?: number | null;
  video_resolution_h?: number | null;
  content_description?: string | null;
  hashtags?: string | unknown;
};

type DashboardClipsGridProps = {
  title: string;
  subtitle: string;
  headerIcon: ReactNode;
  clips: DashboardGridClip[];
  loading: boolean;
  error: string | null;
  /** Full-bleed message when there is nothing to show (handled outside loading/error). */
  emptyContent: ReactNode | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  initialLoadingLabel: string;
  showPersonalizationBadge?: (clip: DashboardGridClip) => boolean;
  /** When true, each tile shows delete (My clips). */
  showDeleteOnEach?: boolean;
  /** Required when showDeleteOnEach — perform API delete; throw on failure. */
  onDeleteClip?: (clip: DashboardGridClip) => Promise<void>;
  showEditOnEach?: boolean;
  onEditClip?: (clip: DashboardGridClip) => void;
  onClipUpdated?: (clip: ClipWithUser) => void;
  /** Bleed classes for the horizontal carousel (defaults to page shell bleed). */
  carouselClassName?: string;
};

export default function DashboardClipsGrid({
  title,
  subtitle,
  headerIcon,
  clips,
  loading,
  error,
  emptyContent,
  hasMore,
  loadMore,
  refresh,
  initialLoadingLabel,
  showPersonalizationBadge = () => false,
  showDeleteOnEach = false,
  onDeleteClip,
  showEditOnEach = false,
  onEditClip,
  onClipUpdated,
  carouselClassName = PAGE_CAROUSEL_BLEED,
}: DashboardClipsGridProps) {
  const [selectedClip, setSelectedClip] = useState<DashboardGridClip | null>(null);
  const [clipPendingDelete, setClipPendingDelete] = useState<DashboardGridClip | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const confirmDeleteClip = async () => {
    if (!clipPendingDelete || !onDeleteClip) return;
    const clipId = clipNumericId(clipPendingDelete);
    const streamId =
      typeof clipPendingDelete.stream_video_id === 'string'
        ? clipPendingDelete.stream_video_id.trim()
        : '';
    if (clipId == null && !streamId) {
      alert('This clip is missing a valid ID. Refresh the page and try again.');
      return;
    }
    setDeleteSubmitting(true);
    try {
      await onDeleteClip(clipPendingDelete);
      setSelectedClip((prev) => {
        if (!prev) return prev;
        if (clipId != null && clipNumericId(prev) === clipId) return null;
        if (streamId) {
          const prevStream =
            typeof prev.stream_video_id === 'string' ? prev.stream_video_id.trim() : '';
          if (prevStream === streamId) return null;
        }
        return prev;
      });
      setClipPendingDelete(null);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Could not delete clip');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (loading && clips.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{initialLoadingLabel}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (emptyContent != null && clips.length === 0) {
    return <>{emptyContent}</>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {headerIcon}
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-gray-400 text-sm">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      <HorizontalClipCarousel
        ariaLabel={title}
        className={carouselClassName}
        stretchItems
      >
        {clips.map((clip, index) => {
          const showDelete = Boolean(showDeleteOnEach && onDeleteClip);
          const showEdit = Boolean(showEditOnEach && onEditClip);
          const rowKey = clipListItemKey(clip, index);
          const clipWithUser = clip as unknown as ClipWithUser;

          return (
            <HorizontalClipCarouselItem key={rowKey}>
              <div className="relative h-full w-full">
                <ClipFeedGridTile
                  clip={clipWithUser}
                  onOpenClip={(c) => setSelectedClip(c as unknown as DashboardGridClip)}
                />

                {(showEdit || showDelete) && (
                  <div
                    className={`absolute z-[25] flex items-center gap-1.5 ${
                      showEdit && showPersonalizationBadge(clip)
                        ? 'top-12 right-2'
                        : 'top-2 right-2'
                    }`}
                  >
                    {showEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditClip!(clip);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white transition-colors hover:bg-momentum-ember/90"
                        title="Edit clip details"
                        aria-label="Edit clip details"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {showDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClipPendingDelete(clip);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white transition-colors hover:bg-red-600/90"
                        title="Delete clip"
                        aria-label="Delete clip"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}

                {showPersonalizationBadge(clip) && (
                  <div
                    className={`pointer-events-none absolute z-[25] rounded-full bg-pink-500 px-2 py-1 ${
                      showEdit ? 'top-12 right-2' : 'top-2 right-2'
                    }`}
                  >
                    <Heart className="h-3 w-3 fill-white text-white" />
                  </div>
                )}
              </div>
            </HorizontalClipCarouselItem>
          );
        })}
      </HorizontalClipCarousel>

      {hasMore && (
        <div className="flex justify-center pt-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </span>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}

      {selectedClip && (
        <ClipModal
          clip={selectedClip as unknown as ClipWithUser}
          onClose={() => setSelectedClip(null)}
          feedNavigation={
            clips.length > 1
              ? {
                  clips: clips as unknown as ClipWithUser[],
                  onChangeClip: (c) => setSelectedClip(c as unknown as DashboardGridClip),
                }
              : null
          }
          onClipUpdated={(updated) => {
            setSelectedClip(updated as unknown as DashboardGridClip);
            onClipUpdated?.(updated);
          }}
        />
      )}

      {clipPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-clip-title-grid"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <h3 id="delete-clip-title-grid" className="text-lg font-bold text-white">
              Delete this moment?
            </h3>
            <p className="mt-2 text-sm text-gray-400">
              This removes your clip from Feedback for everyone. Likes, comments, and saves will be
              removed. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => setClipPendingDelete(null)}
                className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => void confirmDeleteClip()}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
