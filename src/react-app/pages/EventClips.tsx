import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Calendar, MapPin, Loader2 } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import { apiEventClipsPath, artistPath, venuePath } from '@/shared/app-paths';
import { pastShowSummaryToJamBaseEvent } from '@/shared/show-marks';
import ShowMarkButtons from '@/react-app/components/ShowMarkButtons';

function decodeEventTitleParam(param: string | undefined): string {
  if (!param) return '';
  try {
    return decodeURIComponent(param).trim();
  } catch {
    return param.trim();
  }
}

export default function EventClipsPage() {
  const { eventTitle: eventTitleParam } = useParams<{ eventTitle: string }>();
  const navigate = useNavigate();
  const eventTitle = decodeEventTitleParam(eventTitleParam);
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'time_posted' | 'most_liked'>('time_posted');
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showModalFeed, setShowModalFeed] = useState<ClipWithUser[] | null>(null);

  useEffect(() => {
    if (!eventTitle) {
      setClips([]);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const response = await fetch(
          `${apiEventClipsPath(eventTitle)}?sort_by=${sortBy}`,
          { signal: ac.signal },
        );
        if (response.ok) {
          const data = (await response.json()) as { clips?: ClipWithUser[] };
          setClips(data.clips ?? []);
        } else {
          setClips([]);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Failed to fetch event clips:', err);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [eventTitle, sortBy]);

  const showDate =
    clips.length > 0 && clips[0].timestamp
      ? new Date(clips[0].timestamp).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

  const venueName = clips.length > 0 ? clips[0].venue_name : '';
  const location = clips.length > 0 ? clips[0].location : '';
  const artistName = clips.length > 0 ? clips[0].artist_name : null;
  const markEvent =
    clips.length > 0
      ? pastShowSummaryToJamBaseEvent({
          event_title: eventTitle || clips[0].event_title || '',
          artist_name: clips[0].artist_name?.trim() || '',
          show_date: clips[0].timestamp ?? '',
          venue_name: clips[0].venue_name,
          venue_location: clips[0].location,
          jambase_event_id: clips[0].jambase_event_id,
          jambase_venue_id: clips[0].jambase_venue_id,
          jambase_artist_id: clips[0].jambase_artist_id,
        })
      : null;

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          type="button"
          onClick={() => navigate(artistName ? artistPath(artistName) : '/discover')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{artistName ? `Back to ${artistName}` : 'Back to Discover'}</span>
        </button>

        <div className="bg-gradient-to-r from-momentum-ember/20 to-momentum-flare/12 border border-momentum-ember/25 rounded-xl p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-snug">
            {eventTitle || 'Event'}
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-400 text-sm">
                {clips.length} moment{clips.length !== 1 ? 's' : ''}
              </span>
              {markEvent ? <ShowMarkButtons event={markEvent} className="shrink-0" /> : null}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'time_posted' | 'most_liked')}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-momentum-flare"
            >
              <option value="time_posted">Time Posted</option>
              <option value="most_liked">Most Liked</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-12 glass-panel border border-momentum-rose/20 rounded-xl">
            <p className="text-gray-400 text-lg">No clips found for this event</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {clips.map((clip, index) => (
              <button
                key={clipListItemKey(clip, index)}
                type="button"
                onClick={() => {
                  setSelectedClip(clip);
                  setShowModalFeed(clips.length > 1 ? clips : null);
                }}
                className="glass-panel border border-momentum-rose/20 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-all cursor-pointer group text-left"
              >
                <div className="relative aspect-video">
                  <img
                    src={
                      clip.thumbnail_url ||
                      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
                    }
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
              </button>
            ))}
          </div>
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
