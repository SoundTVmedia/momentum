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
import type { ClipWithUser } from '@/shared/types';

type IdentifyStatus = 'idle' | 'loading' | 'done' | 'nomatch' | 'skipped' | 'error';

type AutoIdentifySession = {
  status: Exclude<IdentifyStatus, 'idle'>;
  promptOpen: boolean;
  promptDismissed: boolean;
  manualTitle: string;
};

/** Survives player remounts and looped playback so we identify and prompt once. */
const autoIdentifySessions = new Map<string, AutoIdentifySession>();

function sessionFor(clipKey: string): AutoIdentifySession | undefined {
  return clipKey ? autoIdentifySessions.get(clipKey) : undefined;
}

function writeSession(clipKey: string, patch: Partial<AutoIdentifySession>): AutoIdentifySession | undefined {
  if (!clipKey) return undefined;
  const prev = autoIdentifySessions.get(clipKey) ?? {
    status: 'loading',
    promptOpen: false,
    promptDismissed: false,
    manualTitle: '',
  };
  const next = { ...prev, ...patch };
  autoIdentifySessions.set(clipKey, next);
  return next;
}

type ClipSongRecognitionControlProps = {
  clip: ClipPlaybackFields;
  currentFields: AcrClipFieldSnapshot & ClipMetadataSaveFields;
  asSuperadmin?: boolean;
  onSaved?: (updated: ClipWithUser) => void;
  className?: string;
  buttonClassName?: string;
  /** Idle button label. Edit / admin still use a tap. */
  idleLabel?: string;
  /** Offer a text field so the owner can type the song when ID misses. */
  allowManualEntry?: boolean;
  /** Clip player: start Shazam → ACRCloud as soon as an untitled clip is open. */
  autoStart?: boolean;
  /** Clip player: skip lookup outcome copy (no-match / error). */
  showStatusMessages?: boolean;
};

export default function ClipSongRecognitionControl({
  clip,
  currentFields,
  asSuperadmin = false,
  onSaved,
  className = '',
  buttonClassName = '',
  idleLabel = 'Identify song',
  allowManualEntry = false,
  autoStart = false,
  showStatusMessages = true,
}: ClipSongRecognitionControlProps) {
  const clipKey = String(clipNumericId(clip) ?? clip.stream_video_id ?? '');
  const existingSession = autoStart ? sessionFor(clipKey) : undefined;

  const [status, setStatus] = useState<IdentifyStatus>(
    existingSession?.status ?? (autoStart ? 'loading' : 'idle'),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(
    Boolean(existingSession?.promptOpen && !existingSession?.promptDismissed),
  );
  const [manualTitle, setManualTitle] = useState(existingSession?.manualTitle ?? '');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const runningRef = useRef(false);
  const fieldsRef = useRef(currentFields);
  const onSavedRef = useRef(onSaved);
  fieldsRef.current = currentFields;
  onSavedRef.current = onSaved;

  const clipKeyRef = useRef(clipKey);
  clipKeyRef.current = clipKey;
  const autoStartRef = useRef(autoStart);
  autoStartRef.current = autoStart;
  const allowManualEntryRef = useRef(allowManualEntry);
  allowManualEntryRef.current = allowManualEntry;

  const stopGesture = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const applyManualOpen = (open: boolean, dismissed?: boolean) => {
    setManualOpen(open);
    if (autoStartRef.current) {
      writeSession(clipKeyRef.current, {
        promptOpen: open,
        ...(dismissed != null ? { promptDismissed: dismissed } : {}),
      });
    }
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
    const startedFor = clipKey;
    const auto = autoStartRef.current;
    const prior = auto ? sessionFor(startedFor) : undefined;
    if (auto && prior && prior.status !== 'loading') {
      setStatus(prior.status);
      setManualOpen(prior.promptOpen && !prior.promptDismissed);
      setManualTitle(prior.manualTitle);
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    console.log('[identify] start', clipNumericId(clip) ?? clip.stream_video_id ?? 'unknown');
    setStatus('loading');
    setMessage(null);
    if (auto) writeSession(startedFor, { status: 'loading' });
    else setManualOpen(false);
    try {
      const outcome = await runClipSongRecognitionAndSave({
        clip,
        currentFields: fieldsRef.current,
        asSuperadmin,
        reuseCompleted: auto,
      });
      if (clipKeyRef.current !== startedFor) return;
      if (outcome.status === 'match') {
        setStatus('done');
        setMessage(auto ? null : outcome.message);
        if (auto) writeSession(startedFor, { status: 'done', promptOpen: false });
        onSavedRef.current?.(outcome.updated);
        return;
      }
      setStatus(outcome.status);
      setMessage(auto ? null : outcome.message);
      if (auto) {
        const session = writeSession(startedFor, { status: outcome.status });
        if (allowManualEntryRef.current && session && !session.promptDismissed) {
          applyManualOpen(true);
        }
      } else if (allowManualEntryRef.current) {
        setManualOpen(true);
      }
    } catch (err) {
      if (clipKeyRef.current !== startedFor) return;
      setStatus('error');
      setMessage(auto ? null : err instanceof Error ? err.message : 'Song lookup failed');
      if (auto) {
        const session = writeSession(startedFor, { status: 'error' });
        if (allowManualEntryRef.current && session && !session.promptDismissed) {
          applyManualOpen(true);
        }
      } else if (allowManualEntryRef.current) {
        setManualOpen(true);
      }
    } finally {
      if (clipKeyRef.current === startedFor) runningRef.current = false;
    }
  };

  useEffect(() => {
    setManualError(null);
    setMessage(null);
    if (!autoStart) {
      runningRef.current = false;
      setManualOpen(false);
      setStatus('idle');
      return;
    }
    const session = sessionFor(clipKey);
    if (session && session.status !== 'loading') {
      runningRef.current = false;
      setStatus(session.status);
      setManualTitle(session.manualTitle);
      setManualOpen(session.promptOpen && !session.promptDismissed);
      return;
    }
    if (!session) {
      writeSession(clipKey, { status: 'loading' });
    }
    setStatus('loading');
    void handleRun();
    // Identify once per untitled clip. currentFields is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, clipKey]);

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
        { ...fieldsRef.current, song_title: title },
        { asSuperadmin },
      );
      setStatus('done');
      setMessage(`Saved: ${title}`);
      applyManualOpen(false);
      if (autoStart) writeSession(clipKey, { status: 'done', promptOpen: false, manualTitle: title });
      onSavedRef.current?.(updated);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Could not save the song title');
    } finally {
      setManualSaving(false);
    }
  };

  const identifying = (
    <span
      className={
        buttonClassName ||
        'inline-flex min-h-11 items-center gap-1.5 py-2 text-sm font-semibold text-momentum-flare/90'
      }
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      Identifying
    </span>
  );

  return (
    <div
      className={`relative z-30 pointer-events-auto ${className}`.trim()}
      onPointerDown={stopGesture}
      onTouchStart={stopGesture}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {status === 'loading' ? (
          identifying
        ) : autoStart ? null : (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => void handleRun(e)}
            onPointerDown={stopGesture}
            onTouchStart={stopGesture}
            className={
              buttonClassName ||
              'relative z-30 pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-2 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-500/20 disabled:opacity-50'
            }
          >
            <Disc3 className="h-3.5 w-3.5" aria-hidden />
            {idleLabel}
          </button>
        )}

        {allowManualEntry && !manualOpen && status !== 'loading' && status !== 'done' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextTitle = currentFields.song_title ?? sessionFor(clipKey)?.manualTitle ?? '';
              setManualTitle(nextTitle);
              setManualError(null);
              applyManualOpen(true, false);
              if (autoStart) writeSession(clipKey, { manualTitle: nextTitle });
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
            placeholder="Enter song title"
            aria-label="Song title"
            onChange={(e) => {
              const value = e.target.value;
              setManualTitle(value);
              if (autoStart) writeSession(clipKey, { manualTitle: value });
            }}
            onPointerDown={stopGesture}
            onTouchStart={stopGesture}
            onClick={stopGesture}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') void handleManualSave(e);
              if (e.key === 'Escape') {
                applyManualOpen(false, true);
                setManualError(null);
              }
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
              applyManualOpen(false, true);
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
      {showStatusMessages && !autoStart && status === 'done' && message ? (
        <p className="mt-2 text-xs text-emerald-300">{message}</p>
      ) : null}
      {showStatusMessages && !autoStart && status === 'nomatch' && message ? (
        <p className="mt-2 text-xs text-gray-400">{message}</p>
      ) : null}
      {showStatusMessages && !autoStart && status === 'skipped' && message ? (
        <p className="mt-2 text-xs text-amber-200/90">{message}</p>
      ) : null}
      {showStatusMessages && !autoStart && status === 'error' && message ? (
        <p className="mt-2 text-xs text-red-300">{message}</p>
      ) : null}
    </div>
  );
}
