import { useState } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import {
  allowedShowMarkStatusForEvent,
  jamBaseEventToShowMarkInput,
  type ShowMarkStatus,
} from '@/shared/show-marks';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';

type ShowMarkButtonsProps = {
  event: Record<string, unknown>;
  className?: string;
  compact?: boolean;
};

const STATUS_LABEL: Record<ShowMarkStatus, string> = {
  going: 'Going',
  attended: 'Went',
};

export default function ShowMarkButtons({
  event,
  className = '',
  compact = false,
}: ShowMarkButtonsProps) {
  const { user } = useAuth();
  const { getMarkForEvent, toggleMark, removeMark, hydrated } = useShowMarks();
  const [pending, setPending] = useState(false);

  const eventId = typeof event.identifier === 'string' ? event.identifier : null;
  const allowedStatus = allowedShowMarkStatusForEvent(event);
  const current = eventId ? getMarkForEvent(eventId) : null;
  const active = current?.status === allowedStatus;

  if (!eventId || !allowedStatus) return null;

  const handleToggle = async () => {
    if (!user) {
      alert(
        allowedStatus === 'going'
          ? 'Sign in to mark shows you are going to.'
          : 'Sign in to mark shows you went to.',
      );
      return;
    }
    const input = jamBaseEventToShowMarkInput(event, allowedStatus);
    if (!input) return;
    setPending(true);
    try {
      await toggleMark(input);
    } finally {
      setPending(false);
    }
  };

  const handleRemoveGoing = async () => {
    if (!user || !eventId) return;
    setPending(true);
    try {
      await removeMark(eventId);
    } finally {
      setPending(false);
    }
  };

  const btnClass = [
    'inline-flex items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors',
    compact ? 'px-2 py-1' : 'px-2.5 py-1.5',
    active && allowedStatus === 'going' ? '' : compact ? '' : 'w-full',
    active
      ? 'border-momentum-flare bg-momentum-flare/20 text-momentum-flare'
      : 'border-white/20 bg-white/5 text-gray-300 hover:border-momentum-flare/50 hover:text-white',
  ].join(' ');

  const showGoingRemove = active && allowedStatus === 'going';

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5',
        !compact && !showGoingRemove ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={!hydrated || pending}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleToggle()}
        className={[btnClass, showGoingRemove ? 'flex-1 min-w-0' : ''].filter(Boolean).join(' ')}
        aria-pressed={active}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : active ? (
          <Check className="w-3.5 h-3.5 shrink-0" />
        ) : null}
        <span>{STATUS_LABEL[allowedStatus]}</span>
      </button>
      {showGoingRemove ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleRemoveGoing()}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 p-1.5 text-gray-400 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
          aria-label="Remove from shows you're going to"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}
