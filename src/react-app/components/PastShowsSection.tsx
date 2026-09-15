import { ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import PastShowsCarousel, { type PastShowSummary } from '@/react-app/components/PastShowsCarousel';
import SectionHeading from '@/react-app/components/SectionHeading';
import { HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';

interface PastShowsSectionProps {
  fetchUrl: string;
  variant: 'artist' | 'venue';
  /** Venue archive supports sort; artist feed uses API default order. */
  showSort?: boolean;
}

const PAGE_SIZE = 12;

export default function PastShowsSection({
  fetchUrl,
  variant,
  showSort = false,
}: PastShowsSectionProps) {
  const [shows, setShows] = useState<PastShowSummary[]>([]);
  const [displayedShows, setDisplayedShows] = useState<PastShowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date_played' | 'average_rating'>('date_played');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);

    const separator = fetchUrl.includes('?') ? '&' : '?';
    const requestUrl = showSort
      ? `${fetchUrl}${separator}sort_by=${sortBy}&limit=48`
      : `${fetchUrl}${separator}limit=48`;

    void (async () => {
      try {
        const response = await fetch(requestUrl, { signal: ac.signal });
        if (response.ok) {
          const data = (await response.json()) as { shows?: PastShowSummary[] };
          const allShows = data.shows ?? [];
          setShows(allShows);
          setDisplayedShows(allShows.slice(0, PAGE_SIZE));
          setPage(1);
        } else {
          setShows([]);
          setDisplayedShows([]);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Failed to fetch past shows:', err);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [fetchUrl, sortBy, showSort]);

  const loadMore = () => {
    const nextPage = page + 1;
    setDisplayedShows(shows.slice(0, nextPage * PAGE_SIZE));
    setPage(nextPage);
  };

  if (loading) {
    return (
      <section className={HOME_FEED_SECTION_CLASS}>
        <SectionHeading
          title="Past Shows"
          subtitle="Browse clips from previous concerts"
          size="page"
        />
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
        </div>
      </section>
    );
  }

  if (shows.length === 0) {
    return null;
  }

  return (
    <section className={`${HOME_FEED_SECTION_CLASS} space-y-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          title="Past Shows"
          subtitle="Browse clips grouped by show"
          size="page"
        />
        {showSort ? (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date_played' | 'average_rating')}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-momentum-flare shrink-0"
          >
            <option value="date_played">Most Recent</option>
            <option value="average_rating">Highest Rated</option>
          </select>
        ) : null}
      </div>

      <PastShowsCarousel shows={displayedShows} variant={variant} />

      {displayedShows.length < shows.length ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            className="px-8 py-3 bg-gradient-to-r from-momentum-ember to-momentum-flare rounded-xl text-white font-semibold hover:scale-105 transition-transform flex items-center space-x-2"
          >
            <span>Load More Shows</span>
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
