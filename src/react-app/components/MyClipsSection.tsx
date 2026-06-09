import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import { useClips } from '@/react-app/hooks/useClips';
import DashboardClipsGrid, { type DashboardGridClip } from '@/react-app/components/DashboardClipsGrid';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import ClipEditModal from '@/react-app/components/ClipEditModal';
import { pruneClipFromLocalCaches } from '@/react-app/lib/prune-clip-local-caches';
import { useProfileUploadAction } from '@/react-app/lib/profileUploadAction';

type MyClipsSectionProps = {
  onUploadClick?: () => void;
};

export default function MyClipsSection({ onUploadClick }: MyClipsSectionProps) {
  const { user } = useAuth();
  const handleUploadClick = useProfileUploadAction(onUploadClick);
  const [editingClip, setEditingClip] = useState<DashboardGridClip | null>(null);
  const { clips, loading, error, hasMore, loadMore, refresh, removeClip, removeClipBy, updateClip } = useClips({
    mine: true,
    limit: 20,
    feedType: 'latest',
    contentFeed: 'main',
  });

  const onDeleteClip = async (clip: DashboardGridClip) => {
    const clipId = clipNumericId(clip);
    const rawId = clip.id == null ? null : String(clip.id).trim();
    const streamVideoId =
      typeof clip.stream_video_id === 'string' ? clip.stream_video_id.trim() : '';
    const videoUrl = typeof clip.video_url === 'string' ? clip.video_url.trim() : '';
    const streamPlaybackUrl =
      typeof clip.stream_playback_url === 'string' ? clip.stream_playback_url.trim() : '';
    const body: Record<string, unknown> = {};
    if (clipId != null) body.clipId = clipId;
    if (rawId) body.id = rawId;
    if (streamVideoId) body.streamVideoId = streamVideoId;
    if (videoUrl) body.videoUrl = videoUrl;
    if (streamPlaybackUrl) body.streamPlaybackUrl = streamPlaybackUrl;
    if (body.clipId == null && body.streamVideoId == null && body.id == null && body.videoUrl == null && body.streamPlaybackUrl == null) {
      throw new Error('Could not delete clip');
    }

    const response = await fetch('/api/clips/delete-own', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as { error?: string; deletedId?: number };
    if (!response.ok) {
      const msg = payload.error || 'Could not delete clip';
      // If backend cannot resolve the row but user requested delete from current list,
      // treat "not found" as already removed to keep dashboard state consistent.
      if (response.status === 404) {
        const rawId = clip.id == null ? '' : String(clip.id).trim();
        removeClipBy((c) => {
          const cId = c.id == null ? '' : String(c.id).trim();
          const cStream =
            typeof (c as Record<string, unknown>).stream_video_id === 'string'
              ? String((c as Record<string, unknown>).stream_video_id).trim()
              : '';
          const cVideoUrl =
            typeof (c as Record<string, unknown>).video_url === 'string'
              ? String((c as Record<string, unknown>).video_url).trim()
              : '';
          const cStreamPlayback =
            typeof (c as Record<string, unknown>).stream_playback_url === 'string'
              ? String((c as Record<string, unknown>).stream_playback_url).trim()
              : '';

          return (
            (clipId != null && cId !== '' && Number(cId) === clipId) ||
            (rawId !== '' && cId === rawId) ||
            (streamVideoId !== '' && cStream === streamVideoId) ||
            (videoUrl !== '' && cVideoUrl === videoUrl) ||
            (streamPlaybackUrl !== '' && cStreamPlayback === streamPlaybackUrl)
          );
        });
        if (clipId != null && user) {
          pruneClipFromLocalCaches(clipId, user.id);
        }
        return;
      }
      throw new Error(msg);
    }

    const removedId =
      typeof payload.deletedId === 'number' && Number.isFinite(payload.deletedId)
        ? Math.trunc(payload.deletedId)
        : clipId;
    if (removedId != null && user) {
      pruneClipFromLocalCaches(removedId, user.id);
    }
    if (removedId != null) {
      removeClip(removedId);
    } else {
      void refresh();
    }
  };

  const emptyContent =
    !loading && clips.length === 0 ? (
      <div className="glass-panel rounded-xl p-8">
        <div className="text-center">
          <Upload className="w-12 h-12 text-momentum-flare mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Your moments live here</h3>
          <p className="text-gray-300 mb-6 max-w-md mx-auto">
            You have not uploaded any clips yet. Share a moment from a show and it will show up
            below.
          </p>
          <button
            type="button"
            onClick={handleUploadClick}
            className="px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-105 transition-transform"
          >
            Upload a clip
          </button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <DashboardClipsGrid
        title="My clips"
        subtitle="Everything you have shared on Feedback"
        clips={clips as DashboardGridClip[]}
        loading={loading}
        error={error}
        emptyContent={emptyContent}
        hasMore={hasMore}
        loadMore={loadMore}
        refresh={refresh}
        initialLoadingLabel="Loading your clips..."
        showDeleteOnEach
        onDeleteClip={onDeleteClip}
        showEditOnEach
        onEditClip={(c) => setEditingClip(c)}
        onClipUpdated={(updated) => updateClip(updated)}
      />
      {editingClip && (
        <ClipEditModal
          clip={editingClip}
          onClose={() => setEditingClip(null)}
          onSaved={(updated) => updateClip(updated)}
        />
      )}
    </>
  );
}
