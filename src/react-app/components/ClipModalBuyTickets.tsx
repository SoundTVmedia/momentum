import { ChevronUp, Ticket } from 'lucide-react';
import type { JamBaseShowPick } from '@/shared/jambase-events';

type ClipModalBuyTicketsProps = {
  show: JamBaseShowPick | null;
  loading: boolean;
  onActivate: () => void;
  className?: string;
};

export default function ClipModalBuyTickets({
  show,
  loading,
  onActivate,
  className = '',
}: ClipModalBuyTicketsProps) {
  if (loading || !show?.ticketUrl) {
    return null;
  }

  const hintClass =
    'flex w-full items-center justify-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-[0.98] tap-feedback';

  return (
    <button
      type="button"
      onClick={onActivate}
      className={`${hintClass} ${className}`}
      aria-label="Swipe up to buy tickets to nearest show"
    >
      <Ticket className="h-4 w-4 shrink-0 text-momentum-flare" aria-hidden />
      <span className="md:hidden">Swipe up to buy tickets to nearest show</span>
      <span className="hidden md:inline">Buy tickets to nearest show</span>
      <ChevronUp className="h-4 w-4 shrink-0 animate-bounce md:hidden" aria-hidden />
    </button>
  );
}
