import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import {
  availableShowMarkActionsForEvent,
  jamBaseEventToShowMarkInput,
  isShowMarkActionActive,
  showMarkActionLabel,
  showMarkActionStatus,
  type ShowMarkAction,
  type ShowMarkStatus,
} from '@/shared/show-marks';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';

type ShowMarkButtonsProps = {
  event: Record<string, unknown>;
  className?: string;
  compact?: boolean;
  /** Past-show cards always use I went instead of inferring from event date. */
  statusOverride?: ShowMarkStatus;
};

function signInPrompt(action: ShowMarkAction): string {
  if (action === 'im_there') return 'Sign in to mark that you are at this show.';
  if (action === 'attended') return 'Sign in to mark shows you went to.';
  return 'Sign in to mark shows you are going to.';
}

export default function ShowMarkButtons({
  event,
  className = '',
  compact = false,
  statusOverride,
}: ShowMarkButtonsProps) {
  const { user } = useAuth();
  const { getMarkForEvent, toggleMark, hydrated } = useShowMarks();
  const [pending, setPending] = useState<ShowMarkAction | null>(null);

  const eventId = typeof event.identifier === 'string' ? event.identifier : null;
  const actions = availableShowMarkActionsForEvent(event, new Date(), statusOverride);
  const current = eventId ? getMarkForEvent(eventId) : null;

  if (!eventId || actions.length === 0) return null;

  const handleAction = async (action: ShowMarkAction) => {
    if (!user) {
      alert(signInPrompt(action));
      return;
    }
    const input = jamBaseEventToShowMarkInput(event, showMarkActionStatus(action));
    if (!input) return;
    setPending(action);
    try {
      await toggleMark(input);
    } finally {
      setPending(null);
    }
  };

  const pad = compact ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const stretch = !compact && actions.length === 1;

  return (
    <div
      className={[
        'inline-flex flex-wrap items-center gap-1.5',
        stretch ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={!hydrated || pending !== null}
    >
      {actions.map((action) => {
        const active = isShowMarkActionActive(action, event, current);
        const busy = pending === action;
        return (
          <button
            key={action}
            type="button"
            disabled={pending !== null}
            onClick={() => void handleAction(action)}
            className={[
              'inline-flex items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors',
              pad,
              stretch ? 'w-full' : 'flex-1 min-w-0',
              active
                ? 'border-momentum-flare bg-momentum-flare/20 text-momentum-flare'
                : 'border-white/20 bg-white/5 text-gray-300 hover:border-momentum-flare/50 hover:text-white',
            ].join(' ')}
            aria-pressed={active}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : active ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : null}
            <span>{showMarkActionLabel(action)}</span>
          </button>
        );
      })}
    </div>
  );
}
