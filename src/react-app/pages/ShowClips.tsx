import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Calendar, MapPin, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import ClipPosterImage from '@/react-app/components/ClipPosterImage';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { artistPath, venuePath } from '@/shared/app-paths';
import { pastShowSummaryToJamBaseEvent } from '@/shared/show-marks';
import ShowMarkButtons from '@/react-app/components/ShowMarkButtons';
import { searchPhraseFromSlug, normalizedSlugFromRouteParam, titleCaseWords } from '@/shared/jambase-slug';
import {
  appendUniqueShowClips,
  fetchShowClipsPage,
  type ShowClipsSort,
} from '@/react-app/lib/show-clips-pagination';

export default function ShowClipsPage() {
  const { artistName, showId } = useParams<{ artistName: string; showId: string }>();
  const navigate = useNavigate();
  const artistLabel = artistName
    ? titleCaseWords(searchPhraseFromSlug(normalizedSlugFromRouteParam(artistName)))
    : '';
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState<ShowClipsSort>('time_posted');
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showModalFeed, setShowModalFeed] = useState<ClipWithUser[] | null>(null);
  const fetchGenerationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!artistName || !showId) return;

    const generation = ++fetchGenerationRef.current;
    const controller = new AbortController();
    setClips([]);
    setPage(1);
    setHasMore(false);
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setLoading(true);

    void fetchShowClipsPage({
      artistName,
      showId,
      sortBy,
      page: 1,
      signal: controller.signal,
    })
      .then((result) => {
        if (generation !== fetchGenerationRef.current) return;
        setClips(result.clips);
        setHasMore(result.hasMore);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch show clips:', error);
      })
      .finally(() => {
        if (generation === fetchGenerationRef.current) setLoading(false);
      });

    return () => controller.abort();
  }, [artistName, showId, sortBy]);

  const loadMore = async () => {
    if (!artistName || !showId || loading || !hasMore || loadingMoreRef.current) return;

    const generation = fetchGenerationRef.current;
    const nextPage = page + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await fetchShowClipsPage({
        artistName,
        showId,
        sortBy,
        page: nextPage,
      });
      if (generation !== fetchGenerationRef.current) return;
      setClips((current) => appendUniqueShowClips(current, result.clips));
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to fetch show clips:', error);
    } finally {
      loadingMoreRef.current = false;
      if (generation === fetchGenerationRef.current) setLoadingMore(false);
    }
  };

  const showDate = clips.length > 0 && clips[0].timestamp 
    ? new Date(clips[0].timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const venueName = clips.length > 0 ? clips[0].venue_name : '';
  const location = clips.length > 0 ? clips[0].location : '';
  const markEvent =
    clips.length > 0
      ? pastShowSummaryToJamBaseEvent({
          event_title:
            clips[0].event_title?.trim() ||
            [clips[0].artist_name, clips[0].venue_name].filter(Boolean).join(' at ') ||
            artistLabel ||
            'Show',
          artist_name: clips[0].artist_name?.trim() || artistLabel || '',
          show_date: clips[0].timestamp ?? '',
          venue_name: clips[0].venue_name,
          venue_location: clips[0].location,
          jambase_event_id: clips[0].jambase_event_id ?? showId,
          jambase_venue_id: clips[0].jambase_venue_id,
          jambase_artist_id: clips[0].jambase_artist_id,
        })
      : null;

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <button
          onClick={() => navigate(artistName ? artistPath(artistName) : '/')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to {artistLabel || 'artist'}</span>
        </button>

        {/* Show Header */}
        <div className="bg-gradient-to-r from-momentum-ember/20 to-momentum-flare/12 border border-momentum-ember/25 rounded-xl p-6 sm:p-8 mb-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            {artistLabel || artistName}
          </h1>
          
          <div className="flex flex-wrap gap-4 text-gray-300 mb-4">
            {showDate && (
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-momentum-flare" />
                <span>{showDate}</span>
              </div>
            )}
            {venueName && (
              <button
                type="button"
                onClick={() => navigate(venuePath(venueName))}
                className="flex items-center space-x-2 hover:text-white transition-colors text-left"
              >
                <MapPin className="w-5 h-5 text-momentum-ember shrink-0" />
                <span>{venueName}</span>
                {location && <span className="text-gray-500">• {location}</span>}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-400">
                {clips.length} moment{clips.length !== 1 ? 's' : ''}
              </span>
              {markEvent ? (
                <ShowMarkButtons
                  event={markEvent}
                  statusOverride="attended"
                  className="shrink-0"
                />
              ) : null}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ShowClipsSort)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-momentum-flare"
            >
              <option value="time_posted">Time Posted</option>
              <option value="most_liked">Most Liked</option>
            </select>
          </div>
        </div>

        {/* Clips Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-12 glass-panel border border-momentum-rose/20 rounded-xl">
            <p className="text-gray-400 text-lg">No clips found for this show</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {clips.map((clip, index) => (
                <div
                  key={clipListItemKey(clip, index)}
                  onClick={() => {
                    setSelectedClip(clip);
                    setShowModalFeed(clips.length > 1 ? clips : null);
                  }}
                  className="glass-panel border border-momentum-rose/20 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-all cursor-pointer group"
                >
                  <div className="relative aspect-video">
                    <ClipPosterImage
                      clip={clip}
                      alt="Concert moment"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-4">
                    {clip.content_description && (
                      <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                        {clip.content_description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>{clip.likes_count} likes</span>
                      <span>{clip.views_count} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-6">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => {
            setSelectedClip(null);
            setShowModalFeed(null);
          }}
          feedNavigation={
            showModalFeed && showModalFeed.length > 1
              ? { clips: showModalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      )}
    </div>
  );
}
