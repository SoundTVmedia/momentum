import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '@/react-app/components/Header';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';

const PAGE_SIZE = 24;

export default function BrowsePastShowsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = (searchParams.get('q') || '').trim();
  const [query, setQuery] = useState(urlQuery);
  const debounced = useDebounce(query.trim(), 350);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = debounced.length >= 2 ? debounced : '';
    if (next === urlQuery) return;
    setSearchParams(next ? { q: next } : {}, { replace: true });
  }, [debounced, urlQuery, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    setHasMore(false);

    const params = new URLSearchParams({
      archiveOnly: '1',
      limit: String(PAGE_SIZE),
      page: '1',
    });
    if (debounced.length >= 2) params.set('q', debounced);

    void (async () => {
      try {
        const res = await apiFetch(`/api/jambase/search/events?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Archive search failed');
        const data = (await res.json()) as {
          events?: Record<string, unknown>[];
          hasMore?: boolean;
        };
        if (!cancelled) {
          setEvents(data.events ?? []);
          setHasMore(Boolean(data.hasMore));
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(apiFetchErrorMessage(err, 'Could not load the JamBase archive'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    const params = new URLSearchParams({
      archiveOnly: '1',
      limit: String(PAGE_SIZE),
      page: String(nextPage),
    });
    if (debounced.length >= 2) params.set('q', debounced);

    void (async () => {
      try {
        const res = await apiFetch(`/api/jambase/search/events?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Archive search failed');
        const data = (await res.json()) as {
          events?: Record<string, unknown>[];
          hasMore?: boolean;
        };
        setEvents((current) => {
          const seen = new Set(
            current.map((ev) => (typeof ev.identifier === 'string' ? ev.identifier : '')),
          );
          const incoming = (data.events ?? []).filter((ev) => {
            const id = typeof ev.identifier === 'string' ? ev.identifier : '';
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return [...current, ...incoming];
        });
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        setError(apiFetchErrorMessage(err, 'Could not load more past shows'));
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">
            All Past Shows
          </h1>
          <p className="mt-2 text-gray-400">
            Browse concluded concerts from the JamBase archive, including shows that are not
            already in Feedback.
          </p>
        </div>

        <div className="relative mb-8 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artist, venue, or show name"
            className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-10 pr-3 text-base text-white placeholder:text-white/40"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {error ? <p className="mb-6 text-sm text-red-400">{error}</p> : null}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-gray-400 py-16">
            {debounced.length >= 2
              ? 'No matching past shows in the JamBase archive.'
              : 'No recent archive shows returned. Search an artist or venue to look back about two years.'}
          </p>
        ) : (
          <>
            <JamBaseEventGrid
              preloadedEvents={events}
              maxEvents={events.length}
              layout="grid"
              carouselAriaLabel="Past shows from the JamBase archive"
            />
            {hasMore ? (
              <div className="flex justify-center pt-8">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 bg-gradient-to-r from-momentum-ember to-momentum-flare rounded-xl text-white font-semibold hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {loadingMore ? 'Loading…' : 'Load more past shows'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
