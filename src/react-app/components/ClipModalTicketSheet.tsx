import { useLayoutEffect, useRef } from 'react';
import { Calendar, MapPin, X } from 'lucide-react';
import EventTicketActions from '@/react-app/components/EventTicketActions';
import {
  formatJamBaseEventDate,
  formatJamBaseEventTime,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
  type JamBaseEventRecord,
} from '@/shared/jambase-events';

type ClipTicketSheetDetailsProps = {
  event: JamBaseEventRecord;
  ticketUrl: string;
  eventTitle: string;
  onOpenTickets?: (url: string) => void | Promise<void>;
};

export function ClipTicketSheetHeader({
  eventTitle,
  onClose,
}: {
  eventTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Nearest show</p>
        <p className="truncate text-base font-semibold text-white">{eventTitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-full glass-icon-btn p-2 text-white"
        aria-label="Close tickets and return to clip"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export function ClipTicketSheetDetails({
  event,
  ticketUrl,
  eventTitle,
  onOpenTickets,
}: ClipTicketSheetDetailsProps) {
  const startDate = typeof event.startDate === 'string' ? event.startDate : null;
  const venueName = jamBaseEventVenueName(event);
  const venueCity = jamBaseEventVenueCityLine(event);

  return (
    <div className="shrink-0 px-4 pt-1" data-no-clip-swipe="">
      <div className="mx-auto max-h-[34svh] w-full max-w-md space-y-3 overflow-y-auto">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <div className="flex items-start gap-2 text-white">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-momentum-flare" aria-hidden />
            <div>
              <p className="font-semibold">{formatJamBaseEventDate(startDate)}</p>
              {startDate && formatJamBaseEventTime(startDate) ? (
                <p className="text-sm text-gray-400">{formatJamBaseEventTime(startDate)}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-2 text-white">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-momentum-flare" aria-hidden />
            <div>
              <p className="font-semibold">{venueName}</p>
              {venueCity ? <p className="text-sm text-gray-400">{venueCity}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <EventTicketActions
        ticketUrl={ticketUrl}
        eventTitle={eventTitle}
        className="mx-auto w-full max-w-md py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onGetTicketsClick={
          onOpenTickets
            ? () => {
                void onOpenTickets(ticketUrl);
              }
            : undefined
        }
      />
    </div>
  );
}

type ClipModalTicketSheetProps = {
  event: JamBaseEventRecord;
  ticketUrl: string;
  eventTitle: string;
  onClose: () => void;
  onOpenTickets?: (url: string) => void | Promise<void>;
  /** Live clip is portaled here so playback continues without remounting. */
  onVideoHost?: (node: HTMLDivElement | null) => void;
};

export default function ClipModalTicketSheet({
  event,
  ticketUrl,
  eventTitle,
  onClose,
  onOpenTickets,
  onVideoHost,
}: ClipModalTicketSheetProps) {
  const videoHostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    onVideoHost?.(videoHostRef.current);
    return () => onVideoHost?.(null);
  }, [onVideoHost]);

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-slate-950 animate-fade-in"
      data-no-clip-swipe=""
      role="dialog"
      aria-label={`Buy tickets — ${eventTitle}`}
    >
      <ClipTicketSheetHeader eventTitle={eventTitle} onClose={onClose} />

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        <div ref={videoHostRef} className="h-full w-full" />
      </div>

      <ClipTicketSheetDetails
        event={event}
        ticketUrl={ticketUrl}
        eventTitle={eventTitle}
        onOpenTickets={onOpenTickets}
      />
    </div>
  );
}
