import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PastShowsCarousel, { type PastShowSummary } from '@/react-app/components/PastShowsCarousel';
import FindAShowModal from '@/react-app/components/FindAShowModal';
import SectionHeading from '@/react-app/components/SectionHeading';
import { HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import { BROWSE_PAST_SHOWS_PATH } from '@/react-app/lib/browse-paths';

interface PastShowsSectionProps {
  fetchUrl: string;
  variant: 'artist' | 'venue';
  /** Venue archive supports sort; artist feed uses API default order. */
  showSort?: boolean;
  /** Prefills Find a Show when adding a past show from this page. */
  searchQuery?: string;
}

const PAGE_SIZE = 12;

export default function PastShowsSection({
  fetchUrl,
  variant,
  showSort = false,
  searchQuery = '',
}: PastShowsSectionProps) {
  const [shows, setShows] = useState<PastShowSummary[]>([]);
  const [displayedShows, setDisplayedShows] = useState<PastShowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date_played' | 'average_rating'>('date_played');
  const [page, setPage] = useState(1);
  const [findOpen, setFindOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [fetchUrl, sortBy, showSort, reloadToken]);

  const loadMore = () => {
    const nextPage = page + 1;
    setDisplayedShows(shows.slice(0, nextPage * PAGE_SIZE));
    setPage(nextPage);
  };

  const addButton = (
    <button
      type="button"
      onClick={() => setFindOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-full bg-momentum-flare px-4 py-1.5 text-sm font-semibold text-white hover:scale-[1.02] transition-transform shrink-0"
    >
      <Plus className="h-4 w-4" aria-hidden />
      add a past show
    </button>
  );
  const archiveHref =
    searchQuery.trim().length >= 2
      ? `${BROWSE_PAST_SHOWS_PATH}?q=${encodeURIComponent(searchQuery.trim())}`
      : BROWSE_PAST_SHOWS_PATH;

  return (
    <section className={`${HOME_FEED_SECTION_CLASS} space-y-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          title="Past Shows"
          subtitle={
            shows.length === 0 && !loading
              ? 'Add a concert from the JamBase archive'
              : 'Browse clips grouped by show'
          }
          size="page"
          badge={addButton}
        />
        {showSort && shows.length > 0 ? (
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

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-10 glass-panel border border-momentum-rose/20 rounded-xl">
          <p className="text-gray-400">No past shows yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Use add a past show to create a show page from JamBase.
          </p>
          <Link
            to={archiveHref}
            className="mt-3 inline-block text-sm font-semibold text-momentum-flare hover:underline"
          >
            View all past shows
          </Link>
        </div>
      ) : (
        <>
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
          <div className="flex justify-center pt-1">
            <Link
              to={archiveHref}
              className="text-sm font-semibold text-momentum-flare hover:underline"
            >
              View all past shows
            </Link>
          </div>
        </>
      )}

      {findOpen ? (
        <FindAShowModal
          mode="addPastShow"
          initialQuery={searchQuery}
          onClose={() => setFindOpen(false)}
          onAdded={() => setReloadToken((n) => n + 1)}
        />
      ) : null}
    </section>
  );
}
