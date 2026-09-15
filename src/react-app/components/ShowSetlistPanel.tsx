import { useId, useState } from 'react';
import { ChevronDown, ListMusic } from 'lucide-react';
import type { JamBaseSetlistSong } from '@/shared/jambase-setlist';

type ShowSetlistPanelProps = {
  songs: JamBaseSetlistSong[];
  className?: string;
};

function SetlistSongList({ songs }: { songs: JamBaseSetlistSong[] }) {
  return (
    <ol className="space-y-1.5 text-sm text-gray-300">
      {songs.map((song, index) => (
        <li key={`${song.title}-${index}`} className="flex gap-3">
          <span className="w-6 shrink-0 text-gray-500 tabular-nums">{index + 1}.</span>
          <span>
            {song.title}
            {song.artist ? <span className="text-gray-500"> — {song.artist}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function ShowSetlistPanel({ songs, className = '' }: ShowSetlistPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (songs.length === 0) return null;

  return (
    <div className={className}>
      {/* Mobile: pill toggle + expandable list */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-momentum-flare/40 bg-momentum-flare/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-momentum-flare/25"
        >
          <ListMusic className="h-4 w-4 text-momentum-flare shrink-0" aria-hidden />
          <span>View the Setlist</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-momentum-flare transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open ? (
          <div
            id={panelId}
            className="mt-3 glass-panel border border-momentum-rose/20 rounded-xl p-4 sm:p-5"
          >
            <h2 className="sr-only">Setlist</h2>
            <SetlistSongList songs={songs} />
          </div>
        ) : null}
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden lg:block sticky top-24 glass-panel border border-momentum-rose/20 rounded-xl p-5 xl:p-6 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <ListMusic className="h-5 w-5 text-momentum-flare" aria-hidden />
          Setlist
        </h2>
        <SetlistSongList songs={songs} />
      </aside>
    </div>
  );
}
