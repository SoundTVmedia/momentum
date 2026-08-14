import { useEffect, useState } from 'react';
import { Disc3, Loader2 } from 'lucide-react';
import type { AcrClipFieldSnapshot } from '@/react-app/lib/acrClipFieldPatch';
import {
  runClipSongRecognitionAndSave,
  type ClipMetadataSaveFields,
} from '@/react-app/lib/applyClipSongRecognition';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import type { ClipWithUser } from '@/shared/types';

export const TAP_TO_IDENTIFY_SONG_LABEL = 'Tap to identify song';

type ClipSongRecognitionControlProps = {
  clip: ClipPlaybackFields;
  currentFields: AcrClipFieldSnapshot & ClipMetadataSaveFields;
  asSuperadmin?: boolean;
  onSaved?: (updated: ClipWithUser) => void;
  className?: string;
  buttonClassName?: string;
  /** Player overlay: text-only control that sits where the song title would. */
  variant?: 'default' | 'inline';
};

export default function ClipSongRecognitionControl({
  clip,
  currentFields,
  asSuperadmin = false,
  onSaved,
  className = '',
  buttonClassName = '',
  variant = 'default',
}: ClipSongRecognitionControlProps) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'done' | 'nomatch' | 'skipped' | 'error'
  >('idle');
  const [message, setMessage] = useState<string | null>(null);
  const clipKey = `${clipNumericId(clip) ?? ''}:${clip.stream_video_id ?? ''}`;

  useEffect(() => {
    setStatus('idle');
    setMessage(null);
  }, [clipKey]);

  const handleRun = async () => {
    setStatus('loading');
    setMessage(null);
    try {
      const outcome = await runClipSongRecognitionAndSave({
        clip,
        currentFields,
        asSuperadmin,
      });
      if (outcome.status === 'match') {
        setStatus('done');
        setMessage(outcome.message);
        onSaved?.(outcome.updated);
        return;
      }
      setStatus(outcome.status);
      setMessage(outcome.message);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Song lookup failed');
    }
  };

  const defaultButtonClass =
    variant === 'inline'
      ? 'inline-flex min-w-0 max-w-full items-center gap-1.5 text-left text-sm font-semibold text-momentum-flare/90 transition-opacity hover:opacity-80 disabled:opacity-50'
      : 'inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-500/20 disabled:opacity-50';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={status === 'loading'}
        className={buttonClassName || defaultButtonClass}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Identifying…
          </>
        ) : (
          <>
            <Disc3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{TAP_TO_IDENTIFY_SONG_LABEL}</span>
          </>
        )}
      </button>
      {status === 'loading' ? (
        <p className={`text-xs text-violet-200/90 ${variant === 'inline' ? 'mt-1' : 'mt-2'}`}>
          ShazamKit first, then ACRCloud if needed…
        </p>
      ) : null}
      {status === 'done' && message ? (
        <p className={`text-xs text-emerald-300 ${variant === 'inline' ? 'mt-1' : 'mt-2'}`}>
          {message}
        </p>
      ) : null}
      {status === 'nomatch' && message ? (
        <p className={`text-xs text-gray-400 ${variant === 'inline' ? 'mt-1' : 'mt-2'}`}>
          {message}
        </p>
      ) : null}
      {status === 'skipped' && message ? (
        <p className={`text-xs text-amber-200/90 ${variant === 'inline' ? 'mt-1' : 'mt-2'}`}>
          {message}
        </p>
      ) : null}
      {status === 'error' && message ? (
        <p className={`text-xs text-red-300 ${variant === 'inline' ? 'mt-1' : 'mt-2'}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
