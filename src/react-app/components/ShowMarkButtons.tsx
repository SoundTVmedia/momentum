import { useState } from 'react';
import { Check, Loader2, Upload } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import { useNavigate } from 'react-router';
import {
  availableShowMarkActionsForEvent,
  isAttendedShowMarkActive,
  jamBaseEventToShowMarkInput,
  isShowMarkActionActive,
  showMarkActionLabel,
  showMarkActionStatus,
  type ShowMarkAction,
  type ShowMarkStatus,
} from '@/shared/show-marks';
import { jamBaseEventUpcomingOrInProgress, jamBaseEventImThereEligible, jamBaseEventUsesFestivalRunWindow } from '@/shared/jambase-event-day';
import { archivalUploadNavState } from '@/react-app/lib/archival-upload';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';

type ShowMarkButtonsProps = {
  event: Record<string, unknown>;
  className?: string;
  compact?: boolean;
  /** Past-show cards always use I went instead of inferring from event date. */
  statusOverride?: ShowMarkStatus;
  /** Hero CTAs (festival/show pages) match Get Tickets sizing. */
  size?: 'card' | 'hero';
  /** Show pages: after I went, offer archival clip upload for this show. */
  showUploadClip?: boolean;
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
  size = 'card',
  showUploadClip = false,
}: ShowMarkButtonsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getMarkForEvent, toggleMark, hydrated } = useShowMarks();
  const [pending, setPending] = useState<ShowMarkAction | null>(null);

  const eventId = typeof event.identifier === 'string' ? event.identifier : null;
  const actions = availableShowMarkActionsForEvent(event, new Date(), statusOverride);
  const current = eventId ? getMarkForEvent(eventId) : null;
  const attendedActive = isAttendedShowMarkActive(current);
  const showOver = !jamBaseEventUpcomingOrInProgress(event);
  const festivalLive = jamBaseEventUsesFestivalRunWindow(event) && jamBaseEventImThereEligible(event);
  const offerUpload = Boolean(
    showUploadClip && ((user && attendedActive && current && showOver) || festivalLive),
  );

  if (!eventId || (actions.length === 0 && !offerUpload)) return null;

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

  const pad = compact
    ? 'px-2 py-1'
    : size === 'hero' || showUploadClip
      ? 'px-4 py-2.5 text-sm font-semibold'
      : 'px-2.5 py-1.5';
  const stretch = !compact && actions.length === 1 && !offerUpload;
  const iconClass =
    size === 'hero' || showUploadClip ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0';
  const smallType = compact || (size !== 'hero' && !showUploadClip);

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5',
        offerUpload ? 'flex-nowrap' : 'flex-wrap',
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
        const attendedFilled = action === 'attended' && active;
        return (
          <button
            key={action}
            type="button"
            disabled={pending !== null}
            onClick={() => void handleAction(action)}
            className={[
              'inline-flex items-center justify-center gap-1 rounded-lg border font-medium transition-colors whitespace-nowrap',
              smallType ? 'text-xs' : '',
              pad,
              stretch ? 'w-full' : offerUpload ? 'shrink-0' : 'flex-1 min-w-0',
              attendedFilled
                ? 'border-transparent bg-gradient-to-r from-momentum-flare to-momentum-rose text-white font-semibold shadow-lg'
                : active
                  ? 'border-momentum-flare bg-momentum-flare text-white'
                  : showUploadClip && action === 'attended'
                    ? 'border-momentum-flare bg-momentum-flare text-white hover:opacity-90'
                    : 'border-white/20 bg-white/5 text-gray-300 hover:border-momentum-flare/50 hover:text-white',
            ].join(' ')}
            aria-pressed={active}
          >
            {busy ? (
              <Loader2 className={`${iconClass} animate-spin`} />
            ) : active ? (
              <Check className={iconClass} />
            ) : null}
            <span className="whitespace-nowrap">{showMarkActionLabel(action)}</span>
          </button>
        );
      })}
      {offerUpload ? (
        <button
          type="button"
          onClick={() => {
            if (!user) {
              alert('Sign in to upload a clip from this show.');
              return;
            }
            navigate('/upload?archive=true', {
              state: archivalUploadNavState(current, event),
            });
          }}
          className={[
            'inline-flex items-center justify-center gap-1 rounded-lg font-semibold text-white momentum-grad-interactive whitespace-nowrap shrink-0',
            smallType ? 'text-xs' : '',
            pad,
          ].join(' ')}
        >
          <Upload className={iconClass} aria-hidden />
          <span className="whitespace-nowrap">Upload clip</span>
        </button>
      ) : null}
    </div>
  );
}
