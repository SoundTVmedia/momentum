import { ExternalLink, Loader2, Ticket } from 'lucide-react';
import { useClipPlaybackTickets } from '@/react-app/hooks/useClipPlaybackTickets';

type ClipModalBuyTicketsProps = {
  artistName?: string | null;
  className?: string;
};

export default function ClipModalBuyTickets({
  artistName,
  className = '',
}: ClipModalBuyTicketsProps) {
  const { ticketEvent, loading, needsLocation, noShows, openTickets, enableLocation } =
    useClipPlaybackTickets(artistName);

  if (!loading && noShows && !needsLocation) {
    return (
      <p
        className={`text-sm text-white/75 ${className}`}
        role="status"
      >
        Check back later, this artist has no upcoming shows.
      </p>
    );
  }

  const btnClass =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold momentum-ticket-btn whitespace-nowrap hover:scale-[1.02] transition-transform tap-feedback disabled:opacity-60 disabled:pointer-events-none disabled:hover:scale-100';

  const handleClick = () => {
    if (needsLocation) {
      void enableLocation();
      return;
    }
    void openTickets();
  };

  const label = needsLocation
    ? 'Enable location for tickets'
    : loading
      ? 'Finding tickets…'
      : 'Buy Tickets';

  const disabled = loading || (!needsLocation && !ticketEvent);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`${btnClass} ${className}`}
      aria-busy={loading}
      title={
        ticketEvent
          ? `${ticketEvent.name}${ticketEvent._embedded?.venues?.[0]?.name ? ` · ${ticketEvent._embedded.venues[0].name}` : ''}`
          : undefined
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Ticket className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{label}</span>
      {!loading && ticketEvent ? (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      ) : null}
    </button>
  );
}
