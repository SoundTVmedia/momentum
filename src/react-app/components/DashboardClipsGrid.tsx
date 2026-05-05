import { Loader2, RefreshCw, Trash2, Heart, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import ClipModal from '@/react-app/components/ClipModal';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';

const CLIP_THUMB_FALLBACK =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop';

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
  stream_video_id?: string | null;
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
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8">
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {clips.map((clip, index) => {
          const showDelete = Boolean(showDeleteOnEach && onDeleteClip);
          const showEdit = Boolean(showEditOnEach && onEditClip);

          return (
            <div
              key={clipListItemKey(clip, index)}
              className="group relative aspect-[9/16] bg-black/40 rounded-xl overflow-hidden hover:scale-105 transition-transform"
            >
              <img
                src={
                  clip.thumbnail_url ||
                  clip.stream_thumbnail_url ||
                  CLIP_THUMB_FALLBACK
                }
                alt={(clip.artist_name as string) || 'Concert clip'}
                className="w-full h-full object-cover pointer-events-none"
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedClip(clip)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedClip(clip);
                  }
                }}
                className="absolute inset-0 z-10 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-sm mb-1 truncate">
                      {clip.artist_name || 'Unknown Artist'}
                    </h3>
                    <p className="text-gray-300 text-xs truncate">
                      {clip.venue_name || clip.location || 'Unknown Venue'}
                    </p>
                    <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                      <span>❤️ {clip.likes_count ?? 0}</span>
                      <span>👁️ {clip.views_count ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {showDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClipPendingDelete(clip);
                  }}
                  className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-red-600/90 border border-white/20 transition-colors"
                  title="Delete clip"
                  aria-label="Delete clip"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {showEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClip!(clip);
                  }}
                  className="absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-cyan-600/90 border border-white/20 transition-colors"
                  title="Edit clip details"
                  aria-label="Edit clip details"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}

              {showPersonalizationBadge(clip) && (
                <div
                  className={`absolute z-20 px-2 py-1 bg-pink-500 rounded-full pointer-events-none ${
                    showEdit ? 'top-12 right-2' : 'top-2 right-2'
                  }`}
                >
                  <Heart className="w-3 h-3 text-white fill-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

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
              This removes your clip from Momentum for everyone. Likes, comments, and saves will be
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
