import { useEffect, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react';
import { Check, Disc3, Loader2, Pencil, X } from 'lucide-react';
import type { AcrClipFieldSnapshot } from '@/react-app/lib/acrClipFieldPatch';
import {
  runClipSongRecognitionAndSave,
  saveClipMetadataFields,
  type ClipMetadataSaveFields,
} from '@/react-app/lib/applyClipSongRecognition';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import { identifyStageLabel, type IdentifySongStage } from '@/shared/identify-stage';
import type { ClipWithUser } from '@/shared/types';

type ClipSongRecognitionControlProps = {
  clip: ClipPlaybackFields;
  currentFields: AcrClipFieldSnapshot & ClipMetadataSaveFields;
  asSuperadmin?: boolean;
  onSaved?: (updated: ClipWithUser) => void;
  className?: string;
  buttonClassName?: string;
  /** Idle button label. Clip player uses "Tap to identify". */
  idleLabel?: string;
  /** Offer a text field so the owner can type the song when ID misses. */
  allowManualEntry?: boolean;
};

export default function ClipSongRecognitionControl({
  clip,
  currentFields,
  asSuperadmin = false,
  onSaved,
  className = '',
  buttonClassName = '',
  idleLabel = 'Tap to identify',
  allowManualEntry = false,
}: ClipSongRecognitionControlProps) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'done' | 'nomatch' | 'skipped' | 'error'
  >('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<IdentifySongStage>('start');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const runningRef = useRef(false);

  const stopGesture = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  // iOS WKWebView zooms the visual viewport when a text field focuses. Keep the clip
  // player at scale 1 so typing a song title does not enlarge the video.
  useEffect(() => {
    if (!manualOpen) return;
    const viewport = document.querySelector('meta[name="viewport"]');
    const previous = viewport?.getAttribute('content') ?? '';
    viewport?.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover',
    );
    const resetScale = () => {
      const vv = window.visualViewport;
      if (vv) {
        setKeyboardLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
      } else {
        setKeyboardLift(0);
      }
      window.scrollTo(0, 0);
    };
    resetScale();
    window.visualViewport?.addEventListener('resize', resetScale);
    window.visualViewport?.addEventListener('scroll', resetScale);
    return () => {
      if (viewport) viewport.setAttribute('content', previous);
      setKeyboardLift(0);
      window.visualViewport?.removeEventListener('resize', resetScale);
      window.visualViewport?.removeEventListener('scroll', resetScale);
    };
  }, [manualOpen]);

  const handleRun = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (runningRef.current) return;
    runningRef.current = true;
    console.log('[identify] tap', clipNumericId(clip) ?? clip.stream_video_id ?? 'unknown');
    setStatus('loading');
    setMessage(null);
    setStage('start');
    try {
      const outcome = await runClipSongRecognitionAndSave({
        clip,
        currentFields,
        asSuperadmin,
        onStage: (event) => setStage(event.stage),
      });
      if (outcome.status === 'match') {
        setStatus('done');
        setMessage(outcome.message);
        onSaved?.(outcome.updated);
        return;
      }
      setStatus(outcome.status);
      setMessage(outcome.message);
      // A miss is the moment the owner wants to type it in.
      if (allowManualEntry) setManualOpen(true);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Song lookup failed');
      if (allowManualEntry) setManualOpen(true);
    } finally {
      runningRef.current = false;
    }
  };

  const handleManualSave = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const title = manualTitle.trim();
    if (!title || manualSaving) return;
    setManualSaving(true);
    setManualError(null);
    try {
      const updated = await saveClipMetadataFields(
        clip,
        { ...currentFields, song_title: title },
        { asSuperadmin },
      );
      setStatus('done');
      setMessage(`Saved: ${title}`);
      setManualOpen(false);
      onSaved?.(updated);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Could not save the song title');
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div
      className={`relative z-30 pointer-events-auto ${className}`.trim()}
      onPointerDown={stopGesture}
      onTouchStart={stopGesture}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={(e: MouseEvent<HTMLButtonElement>) => void handleRun(e)}
          onPointerDown={stopGesture}
          onTouchStart={stopGesture}
          disabled={status === 'loading'}
          className={
            buttonClassName ||
            'relative z-30 pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-2 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-500/20 disabled:opacity-50'
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
              {idleLabel}
            </>
          )}
        </button>

        {allowManualEntry && !manualOpen && status !== 'loading' && status !== 'done' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualTitle(currentFields.song_title ?? '');
              setManualError(null);
              setManualOpen(true);
            }}
            onPointerDown={stopGesture}
            onTouchStart={stopGesture}
            className="inline-flex min-h-11 items-center gap-1.5 py-2 text-sm font-medium text-white/70 underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Enter song title
          </button>
        ) : null}
      </div>

      {allowManualEntry && manualOpen ? (
        <div
          className="mt-2 flex items-center gap-2"
          style={keyboardLift > 0 ? { transform: `translateY(-${keyboardLift}px)` } : undefined}
        >
          <input
            type="text"
            value={manualTitle}
            autoFocus
            enterKeyHint="done"
            placeholder="Song title"
            aria-label="Song title"
            onChange={(e) => setManualTitle(e.target.value)}
            onPointerDown={stopGesture}
            onTouchStart={stopGesture}
            onClick={stopGesture}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') void handleManualSave(e);
              if (e.key === 'Escape') setManualOpen(false);
            }}
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-base text-white placeholder:text-white/40 focus:border-momentum-ember/60 focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{ fontSize: 16 }}
          />
          <button
            type="button"
            onClick={(e) => void handleManualSave(e)}
            onPointerDown={stopGesture}
            onTouchStart={stopGesture}
            disabled={!manualTitle.trim() || manualSaving}
            aria-label="Save song title"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-momentum-ember/40 bg-momentum-ember/15 text-momentum-flare transition-colors hover:bg-momentum-ember/25 disabled:opacity-40"
          >
            {manualSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualOpen(false);
              setManualError(null);
            }}
            onPointerDown={stopGesture}
            onTouchStart={stopGesture}
            aria-label="Cancel song title"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {manualError ? <p className="mt-2 text-xs text-red-300">{manualError}</p> : null}
      {status === 'loading' ? (
        <p className="mt-2 text-xs text-violet-200/90">{identifyStageLabel(stage)}</p>
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
