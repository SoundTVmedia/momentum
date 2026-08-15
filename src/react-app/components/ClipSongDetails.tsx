import { useState } from 'react';
import { Check, Disc3, Pencil, X } from 'lucide-react';
import ClipSongRecognitionControl from '@/react-app/components/ClipSongRecognitionControl';
import { metadataFieldsFromClip } from '@/react-app/lib/clipFormFields';
import { saveClipMetadataFields } from '@/react-app/lib/applyClipSongRecognition';
import { clipShowsOpenerBadge, songTitlesMatch } from '@/shared/clip-song-credit';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import type { ClipWithUser } from '@/shared/types';

type ClipSongFields = ClipPlaybackFields & {
  artist_name?: string | null;
  song_title?: string | null;
  recognized_song_title?: string | null;
  recognized_song_artist?: string | null;
  song_title_forced?: number | boolean | string | null;
};

type ClipSongDetailsProps = {
  clip: ClipSongFields;
  canEdit: boolean;
  asSuperadmin?: boolean;
  onSaved?: (updated: ClipWithUser) => void;
  onGoSong?: () => void;
  variant?: 'overlay' | 'sheet';
};

export default function ClipSongDetails({
  clip,
  canEdit,
  asSuperadmin = false,
  onSaved,
  onGoSong,
  variant = 'overlay',
}: ClipSongDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(clip.song_title?.trim() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingForce, setPendingForce] = useState<string | null>(null);

  const title = clip.song_title?.trim() ?? '';
  const recognizedTitle = clip.recognized_song_title?.trim() ?? '';
  const recognizedArtist = clip.recognized_song_artist?.trim() ?? '';
  const isOpener = clipShowsOpenerBadge(clip);
  const fields = metadataFieldsFromClip(clip);

  const titleClass =
    variant === 'sheet'
      ? 'truncate text-base font-semibold text-momentum-flare/90'
      : 'truncate text-sm font-semibold text-white/90';

  const persistTitle = async (nextTitle: string, forced: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveClipMetadataFields(
        clip,
        {
          ...fields,
          song_title: nextTitle,
          recognized_song_title: recognizedTitle || fields.recognized_song_title || null,
          recognized_song_artist: recognizedArtist || fields.recognized_song_artist || null,
          song_title_forced: forced ? 1 : 0,
        },
        { asSuperadmin },
      );
      setEditing(false);
      setPendingForce(null);
      onSaved?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save song title');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => {
    const next = draft.trim();
    if (!next) {
      setError('Enter a song title, or cancel.');
      return;
    }
    if (recognizedTitle && !songTitlesMatch(next, recognizedTitle)) {
      setPendingForce(next);
      return;
    }
    void persistTitle(next, false);
  };

  return (
    <div className={variant === 'sheet' ? 'space-y-1.5' : 'space-y-1'}>
      {editing ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <Disc3 className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setPendingForce(null);
              setError(null);
            }}
            maxLength={200}
            placeholder="Song title"
            className="min-w-0 flex-1 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-sm text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
            aria-label="Song title"
          />
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={saving}
            className="rounded-md p-1 text-emerald-300 hover:bg-white/10 disabled:opacity-50"
            aria-label="Save song title"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(title);
              setPendingForce(null);
              setError(null);
            }}
            className="rounded-md p-1 text-gray-300 hover:bg-white/10"
            aria-label="Cancel song title edit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          {title && onGoSong ? (
            <button type="button" onClick={onGoSong} className="flex min-w-0 items-center gap-1.5 text-left">
              <Disc3 className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              <span className={titleClass}>{title}</span>
            </button>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              <Disc3 className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              <span className={title ? titleClass : 'truncate text-sm text-white/60'}>
                {title || 'Add song title'}
              </span>
            </span>
          )}
          {isOpener ? (
            <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Opener
            </span>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                setDraft(title);
                setEditing(true);
                setError(null);
              }}
              className="shrink-0 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label={title ? 'Edit song title' : 'Add song title'}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      )}

      {pendingForce ? (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] leading-snug text-amber-50">
          <p>
            We identified <span className="font-semibold">{recognizedTitle}</span>
            {recognizedArtist ? ` — ${recognizedArtist}` : ''}. You entered{' '}
            <span className="font-semibold">{pendingForce}</span>.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistTitle(recognizedTitle, false)}
              className="rounded-md bg-white/15 px-2 py-0.5 font-semibold text-white hover:bg-white/25 disabled:opacity-50"
            >
              Keep identified
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistTitle(pendingForce, true)}
              className="rounded-md px-2 py-0.5 font-semibold text-amber-100 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Use my title
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

      {canEdit ? (
        <ClipSongRecognitionControl
          clip={clip}
          currentFields={fields}
          asSuperadmin={asSuperadmin}
          onSaved={onSaved}
          variant="inline"
        />
      ) : null}
    </div>
  );
}
