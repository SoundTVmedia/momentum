import { Calendar, MapPin, Ticket, X } from 'lucide-react';
import EventTicketActions from '@/react-app/components/EventTicketActions';
import {
  formatJamBaseEventDate,
  formatJamBaseEventTime,
  jamBaseEventCardImageUrl,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
  type JamBaseEventRecord,
} from '@/shared/jambase-events';
import { displayMediaUrl } from '@/shared/media-proxy';

type ClipModalTicketSheetProps = {
  event: JamBaseEventRecord;
  ticketUrl: string;
  eventTitle: string;
  onClose: () => void;
};

export default function ClipModalTicketSheet({
  event,
  ticketUrl,
  eventTitle,
  onClose,
}: ClipModalTicketSheetProps) {
  const startDate = typeof event.startDate === 'string' ? event.startDate : null;
  const venueName = jamBaseEventVenueName(event);
  const venueCity = jamBaseEventVenueCityLine(event);
  const imageUrl = displayMediaUrl(jamBaseEventCardImageUrl(event));

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-slate-950 animate-fade-in"
      role="dialog"
      aria-label={`Buy tickets — ${eventTitle}`}
    >
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
            <div className="aspect-[16/10] w-full overflow-hidden bg-black">
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-3 p-4">
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

          <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4 text-center">
            <Ticket className="mx-auto mb-2 h-8 w-8 text-momentum-flare" aria-hidden />
            <p className="text-sm text-gray-300">
              Ticket checkout opens in your browser — ticket sites don&apos;t allow in-app
              checkout.
            </p>
          </div>

          <EventTicketActions ticketUrl={ticketUrl} eventTitle={eventTitle} className="w-full" />
        </div>
      </div>
    </div>
  );
}
