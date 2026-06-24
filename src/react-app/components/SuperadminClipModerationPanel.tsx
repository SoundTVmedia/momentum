import { useState } from 'react';
import { Loader2, Pencil, Search, Trash2, Video } from 'lucide-react';
import ClipPosterImage from '@/react-app/components/ClipPosterImage';
import ClipEditModal from '@/react-app/components/ClipEditModal';
import ClipSongRecognitionControl from '@/react-app/components/ClipSongRecognitionControl';
import { metadataFieldsFromClip } from '@/react-app/lib/clipFormFields';
import type { ClipWithUser } from '@/shared/types';

type ModerationClip = ClipWithUser & {
  is_hidden: number;
};

export default function SuperadminClipModerationPanel() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [clips, setClips] = useState<ModerationClip[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingClip, setEditingClip] = useState<ModerationClip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      return;
    }

    setSearching(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/clips/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Search failed');
      }
      const data = (await response.json()) as { clips: ModerationClip[] };
      setClips(data.clips || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search clips.');
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteClip = async (clip: ModerationClip) => {
    if (
      !window.confirm(
        `Permanently delete clip #${clip.id}${clip.artist_name ? ` (${clip.artist_name})` : ''}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(clip.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/clips/${clip.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not delete clip');
      }
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
      setSuccess(`Deleted clip #${clip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete clip');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Clip Moderation</h2>
        <p className="text-gray-400">
          Search any clip by ID, artist, venue, uploader name, or user ID and permanently remove it.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Clip ID, artist, venue, uploader..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold disabled:opacity-50"
        >
          {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
          {success}
        </div>
      )}

      {clips.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Search for a clip to review or remove.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="glass-panel border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row gap-4"
            >
              <ClipPosterImage
                clip={clip}
                alt=""
                className="w-full sm:w-40 h-28 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-white font-semibold">Clip #{clip.id}</p>
                  {clip.is_hidden === 1 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-500/30">
                      Hidden
                    </span>
                  )}
                </div>
                {clip.artist_name && (
                  <p className="text-momentum-rose text-sm">{clip.artist_name}</p>
                )}
                {clip.venue_name && <p className="text-gray-400 text-sm">{clip.venue_name}</p>}
                {clip.song_title?.trim() ? (
                  <p className="text-violet-200/90 text-sm">Song: {clip.song_title}</p>
                ) : null}
                <p className="text-gray-500 text-sm mt-1">
                  By {clip.user_display_name || clip.mocha_user_id}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {new Date(clip.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col gap-2 self-start">
                <button
                  type="button"
                  onClick={() => setEditingClip(clip)}
                  className="px-4 py-2 bg-violet-500/15 border border-violet-500/30 rounded-lg text-violet-100 hover:bg-violet-500/25 transition-colors flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <ClipSongRecognitionControl
                  clip={clip}
                  currentFields={metadataFieldsFromClip(clip)}
                  asSuperadmin
                  onSaved={(updated) => {
                    setClips((prev) =>
                      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
                    );
                    setSuccess(
                      updated.song_title?.trim()
                        ? `Clip #${updated.id}: matched "${updated.song_title}"`
                        : `Song recognition updated clip #${updated.id}`,
                    );
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleDeleteClip(clip)}
                  disabled={deletingId === clip.id}
                  className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {deletingId === clip.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingClip ? (
        <ClipEditModal
          clip={editingClip}
          asSuperadmin
          onClose={() => setEditingClip(null)}
          onSaved={(updated) => {
            setClips((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
            );
            setEditingClip(null);
            setSuccess(`Saved changes to clip #${updated.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
