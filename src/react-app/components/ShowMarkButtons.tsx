import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import {
  jamBaseEventToShowMarkInput,
  type ShowMarkStatus,
} from '@/shared/show-marks';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';

type ShowMarkButtonsProps = {
  event: Record<string, unknown>;
  className?: string;
  compact?: boolean;
};

export default function ShowMarkButtons({
  event,
  className = '',
  compact = false,
}: ShowMarkButtonsProps) {
  const { user } = useAuth();
  const { getMarkForEvent, toggleMark, hydrated } = useShowMarks();
  const [pending, setPending] = useState<ShowMarkStatus | null>(null);

  const eventId = typeof event.identifier === 'string' ? event.identifier : null;
  const current = eventId ? getMarkForEvent(eventId) : null;

  if (!eventId) return null;

  const handleToggle = async (status: ShowMarkStatus) => {
    if (!user) {
      alert('Sign in to mark shows you are going to or have been to.');
      return;
    }
    const input = jamBaseEventToShowMarkInput(event, status);
    if (!input) return;
    setPending(status);
    try {
      await toggleMark(input);
    } finally {
      setPending(null);
    }
  };

  const btnClass = (active: boolean) =>
    [
      'inline-flex items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors',
      compact ? 'px-2 py-1' : 'px-2.5 py-1.5 flex-1',
      active
        ? 'border-momentum-flare bg-momentum-flare/20 text-momentum-flare'
        : 'border-white/20 bg-white/5 text-gray-300 hover:border-momentum-flare/50 hover:text-white',
    ].join(' ');

  return (
    <div
      className={`flex gap-2 ${compact ? '' : 'w-full'} ${className}`}
      aria-busy={!hydrated || pending != null}
    >
      <button
        type="button"
        disabled={pending != null}
        onClick={() => void handleToggle('going')}
        className={btnClass(current?.status === 'going')}
        aria-pressed={current?.status === 'going'}
      >
        {pending === 'going' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : current?.status === 'going' ? (
          <Check className="w-3.5 h-3.5 shrink-0" />
        ) : null}
        <span>Going</span>
      </button>
      <button
        type="button"
        disabled={pending != null}
        onClick={() => void handleToggle('attended')}
        className={btnClass(current?.status === 'attended')}
        aria-pressed={current?.status === 'attended'}
      >
        {pending === 'attended' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : current?.status === 'attended' ? (
          <Check className="w-3.5 h-3.5 shrink-0" />
        ) : null}
        <span>Been</span>
      </button>
    </div>
  );
}
