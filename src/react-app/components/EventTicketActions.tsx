import { useState } from 'react';
import { ExternalLink, Share2, Ticket } from 'lucide-react';
import { shareEventTickets } from '@/react-app/lib/shareEventTickets';

type EventTicketActionsProps = {
  ticketUrl: string;
  eventTitle?: string;
  className?: string;
  /** When set, Get Tickets runs this handler instead of a plain link (e.g. analytics + window.open). */
  onGetTicketsClick?: () => void | Promise<void>;
};

export default function EventTicketActions({
  ticketUrl,
  eventTitle,
  className = '',
  onGetTicketsClick,
}: EventTicketActionsProps) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const handleShare = async () => {
    const result = await shareEventTickets(ticketUrl, eventTitle);
    if (result === 'copied') {
      setShareHint('Link copied');
      window.setTimeout(() => setShareHint(null), 2000);
    }
  };

  const ticketsClass =
    'flex flex-1 min-w-0 items-center justify-center gap-1.5 max-md:gap-1 px-3 max-md:px-2.5 py-2.5 max-md:py-2 momentum-ticket-btn rounded-lg text-sm max-md:text-xs font-semibold whitespace-nowrap hover:scale-[1.02] transition-transform tap-feedback';

  return (
    <div className={className}>
      <div className="flex gap-2 items-stretch">
        {onGetTicketsClick ? (
          <button type="button" onClick={() => void onGetTicketsClick()} className={ticketsClass}>
            <Ticket className="w-4 h-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">Get Tickets</span>
            <ExternalLink className="w-3 h-3 max-md:w-2.5 max-md:h-2.5 shrink-0 opacity-80" aria-hidden />
          </button>
        ) : (
          <a
            href={ticketUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className={ticketsClass}
          >
            <Ticket className="w-4 h-4 max-md:w-3.5 max-md:h-3.5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">Get Tickets</span>
            <ExternalLink className="w-3 h-3 max-md:w-2.5 max-md:h-2.5 shrink-0 opacity-80" aria-hidden />
          </a>
        )}
        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex shrink-0 items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white font-semibold text-sm hover:bg-white/15 active:scale-[0.98] transition-all tap-feedback"
          aria-label={shareHint ?? 'Share event tickets link'}
          title="Share Ticketmaster link"
        >
          <Share2 className="w-4 h-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
      {shareHint ? (
        <p className="text-xs text-momentum-flare/90 mt-1.5 text-center" role="status">
          {shareHint}
        </p>
      ) : null}
    </div>
  );
}
