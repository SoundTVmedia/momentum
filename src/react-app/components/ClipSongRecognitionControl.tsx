import { useState } from 'react';
import { Disc3, Loader2 } from 'lucide-react';
import type { AcrClipFieldSnapshot } from '@/react-app/lib/acrClipFieldPatch';
import {
  runClipSongRecognitionAndSave,
  type ClipMetadataSaveFields,
} from '@/react-app/lib/applyClipSongRecognition';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import type { ClipWithUser } from '@/shared/types';

type ClipSongRecognitionControlProps = {
  clip: ClipPlaybackFields;
  currentFields: AcrClipFieldSnapshot & ClipMetadataSaveFields;
  asSuperadmin?: boolean;
  onSaved?: (updated: ClipWithUser) => void;
  className?: string;
  buttonClassName?: string;
};

export default function ClipSongRecognitionControl({
  clip,
  currentFields,
  asSuperadmin = false,
  onSaved,
  className = '',
  buttonClassName = '',
}: ClipSongRecognitionControlProps) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'done' | 'nomatch' | 'skipped' | 'error'
  >('idle');
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={status === 'loading'}
        className={
          buttonClassName ||
          'inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-500/20 disabled:opacity-50'
        }
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Identifying…
          </>
        ) : (
          <>
            <Disc3 className="h-3.5 w-3.5" aria-hidden />
            Run song recognition
          </>
        )}
      </button>
      {status === 'loading' ? (
        <p className="mt-2 text-xs text-violet-200/90">Listening to this clip with ACRCloud…</p>
      ) : null}
      {status === 'done' && message ? (
        <p className="mt-2 text-xs text-emerald-300">{message}</p>
      ) : null}
      {status === 'nomatch' && message ? (
        <p className="mt-2 text-xs text-gray-400">{message}</p>
      ) : null}
      {status === 'skipped' && message ? (
        <p className="mt-2 text-xs text-amber-200/90">{message}</p>
      ) : null}
      {status === 'error' && message ? (
        <p className="mt-2 text-xs text-red-300">{message}</p>
      ) : null}
    </div>
  );
}
