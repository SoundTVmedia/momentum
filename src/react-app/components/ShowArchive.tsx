import { Calendar, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import PastShowsGrid, { type PastShowSummary } from '@/react-app/components/PastShowsGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { apiVenuePath } from '@/shared/app-paths';

interface ShowArchiveProps {
  venueName: string;
}

const SHOWS_PER_PAGE = 8;

export default function ShowArchive({ venueName }: ShowArchiveProps) {
  const [shows, setShows] = useState<PastShowSummary[]>([]);
  const [displayedShows, setDisplayedShows] = useState<PastShowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date_played' | 'average_rating'>('date_played');
  const [showsPage, setShowsPage] = useState(1);

  useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiVenuePath(venueName)}/archive?sort_by=${sortBy}&limit=100`,
          { signal: ac.signal },
        );
        if (response.ok) {
          const data = (await response.json()) as { shows?: PastShowSummary[] };
          const allShows = data.shows ?? [];
          setShows(allShows);
          setDisplayedShows(allShows.slice(0, SHOWS_PER_PAGE));
          setShowsPage(1);
        } else {
          setShows([]);
          setDisplayedShows([]);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Failed to fetch shows:', err);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [venueName, sortBy]);

  const loadMoreShows = () => {
    const nextPage = showsPage + 1;
    const startIndex = showsPage * SHOWS_PER_PAGE;
    const endIndex = startIndex + SHOWS_PER_PAGE;
    setDisplayedShows((prev) => [...prev, ...shows.slice(startIndex, endIndex)]);
    setShowsPage(nextPage);
  };

  const hasMoreShows = displayedShows.length < shows.length;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (shows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          title="Past Shows"
          subtitle="Tap a show to browse all clips from that night"
          icon={Calendar}
          iconClassName="text-momentum-rose"
          size="page"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date_played' | 'average_rating')}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-momentum-flare shrink-0"
        >
          <option value="date_played">Most Recent</option>
          <option value="average_rating">Highest Rated</option>
        </select>
      </div>

      <PastShowsGrid shows={displayedShows} variant="venue" venueLabel={venueName} />

      {hasMoreShows && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={loadMoreShows}
            className="px-8 py-3 bg-gradient-to-r from-momentum-ember to-momentum-flare rounded-xl text-white font-semibold hover:scale-105 transition-transform flex items-center space-x-2"
          >
            <span>Load More Shows</span>
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
}
