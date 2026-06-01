import { ExternalLink, Ticket } from 'lucide-react';
import { useClipPlaybackTickets } from '@/react-app/hooks/useClipPlaybackTickets';

type ClipModalBuyTicketsProps = {
  artistName?: string | null;
  className?: string;
};

export default function ClipModalBuyTickets({
  artistName,
  className = '',
}: ClipModalBuyTicketsProps) {
  const artist = artistName?.trim() ?? '';
  const { show, loading, openTickets } = useClipPlaybackTickets(artistName);

  if (!artist || loading || !show) {
    return null;
  }

  const title =
    typeof show.event.name === 'string'
      ? show.event.name
      : 'Upcoming show';

  const btnClass =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white momentum-grad-interactive whitespace-nowrap shadow-lg shadow-momentum-ember/30 hover:scale-[1.02] tap-feedback';

  return (
    <button
      type="button"
      onClick={openTickets}
      className={`${btnClass} ${className}`}
      title={title}
    >
      <Ticket className="h-4 w-4 shrink-0" aria-hidden />
      <span>Buy Tickets</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
    </button>
  );
}
