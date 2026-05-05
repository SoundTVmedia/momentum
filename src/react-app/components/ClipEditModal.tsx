import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { ClipWithUser } from '@/shared/types';
import type { DashboardGridClip } from '@/react-app/components/DashboardClipsGrid';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';

type EditableClip = ClipWithUser | DashboardGridClip;

function hashtagsToInput(hashtags: unknown): string {
  if (hashtags == null || hashtags === '') return '';
  if (typeof hashtags === 'string') {
    try {
      const p = JSON.parse(hashtags) as unknown;
      if (Array.isArray(p)) return p.map(String).join(', ');
    } catch {
      return hashtags;
    }
  }
  if (Array.isArray(hashtags)) return hashtags.map(String).join(', ');
  return '';
}

type ClipEditModalProps = {
  clip: EditableClip;
  onClose: () => void;
  onSaved: (updated: ClipWithUser) => void;
};

export default function ClipEditModal({ clip, onClose, onSaved }: ClipEditModalProps) {
  const [artistName, setArtistName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setArtistName((clip.artist_name as string) ?? '');
    setVenueName((clip.venue_name as string) ?? '');
    setLocation((clip.location as string) ?? '');
    setDescription((clip.content_description as string) ?? '');
    setHashtags(hashtagsToInput(clip.hashtags));
    setError(null);
  }, [clip]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clipId = clipNumericId(clip);
    const streamVideoId =
      typeof (clip as { stream_video_id?: unknown }).stream_video_id === 'string'
        ? String((clip as { stream_video_id: string }).stream_video_id).trim()
        : '';
    if (clipId == null && !streamVideoId) {
      setError('Invalid clip');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        artist_name: artistName,
        venue_name: venueName,
        location,
        content_description: description,
        hashtags,
      };
      if (clipId != null) payload.clipId = clipId;
      if (streamVideoId) payload.streamVideoId = streamVideoId;

      const response = await fetch('/api/clips/update-own', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let msg = 'Could not save changes';
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) msg = data.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const updated = (await response.json()) as ClipWithUser;
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clip-edit-title"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-cyan-500/20 bg-slate-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <h2 id="clip-edit-title" className="text-lg font-bold text-white">
            Edit clip details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          <p className="text-sm text-gray-400">
            Update how this moment appears in the feed. Video files are not changed here.
          </p>

          <div>
            <label htmlFor="edit-artist" className="mb-1 block text-sm font-medium text-gray-300">
              Artist
            </label>
            <input
              id="edit-artist"
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Artist name"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="edit-venue" className="mb-1 block text-sm font-medium text-gray-300">
              Venue
            </label>
            <input
              id="edit-venue"
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Venue name"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="edit-location" className="mb-1 block text-sm font-medium text-gray-300">
              Location
            </label>
            <input
              id="edit-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="City, state"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="edit-desc" className="mb-1 block text-sm font-medium text-gray-300">
              Caption
            </label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="What was this moment?"
              maxLength={2000}
            />
          </div>

          <div>
            <label htmlFor="edit-tags" className="mb-1 block text-sm font-medium text-gray-300">
              Hashtags
            </label>
            <input
              id="edit-tags"
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="livemusic, tour2025 (comma-separated)"
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
