import { ExternalLink, X } from 'lucide-react';

type ClipModalTicketSheetProps = {
  ticketUrl: string;
  eventTitle: string;
  onClose: () => void;
};

export default function ClipModalTicketSheet({
  ticketUrl,
  eventTitle,
  onClose,
}: ClipModalTicketSheetProps) {
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

      <iframe
        src={ticketUrl}
        title={`Buy tickets — ${eventTitle}`}
        className="min-h-0 flex-1 w-full border-0 bg-white"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />

      <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-momentum-flare hover:underline"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open in browser
        </a>
      </div>
    </div>
  );
}
