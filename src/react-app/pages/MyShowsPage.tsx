import { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Loader2, MapPin, Music } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';
import type { UserShowMark } from '@/shared/show-marks';
import { artistPath, venuePath } from '@/shared/app-paths';

type Tab = 'going' | 'attended';

function formatShowDate(iso: string | null): string {
  if (!iso?.trim()) return 'Date TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ShowMarkRow({ mark }: { mark: UserShowMark }) {
  const navigate = useNavigate();
  const title =
    mark.event_title?.trim() ||
    [mark.artist_name, mark.venue_name].filter(Boolean).join(' at ') ||
    'Show';

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-4 sm:p-5 space-y-2">
      <h2 className="text-lg font-bold text-white leading-snug">{title}</h2>
      {mark.artist_name ? (
        <button
          type="button"
          onClick={() => navigate(artistPath(mark.artist_name!))}
          className="flex items-center gap-2 text-sm text-momentum-rose hover:text-momentum-rose/80"
        >
          <Music className="w-4 h-4 shrink-0" />
          <span>{mark.artist_name}</span>
        </button>
      ) : null}
      {mark.venue_name ? (
        <button
          type="button"
          onClick={() => navigate(venuePath(mark.venue_name!))}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white text-left"
        >
          <MapPin className="w-4 h-4 shrink-0 text-green-400" />
          <span>
            {mark.venue_name}
            {mark.venue_location ? ` · ${mark.venue_location}` : ''}
          </span>
        </button>
      ) : null}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Calendar className="w-4 h-4 shrink-0" />
        <span>{formatShowDate(mark.start_date)}</span>
      </div>
    </div>
  );
}

export default function MyShowsPage() {
  const navigate = useNavigate();
  const { goingMarks, attendedMarks, loading, hydrated } = useShowMarks();
  const [tab, setTab] = useState<Tab>('going');

  const list = useMemo(
    () => (tab === 'going' ? goingMarks : attendedMarks),
    [tab, goingMarks, attendedMarks],
  );

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">My shows</h1>
          <p className="mt-2 text-gray-400">
            Shows you plan to attend and shows you have been to — used to improve venue matching and
            recommendations.
          </p>
        </div>

        <div className="flex gap-2 mb-8 p-1 rounded-xl bg-white/5 border border-white/10">
          {(['going', 'attended'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-momentum-flare/20 text-momentum-flare'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {key === 'going' ? `Going (${goingMarks.length})` : `Been (${attendedMarks.length})`}
            </button>
          ))}
        </div>

        {!hydrated || loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 glass-panel rounded-xl border border-white/10">
            <p className="text-gray-300">
              {tab === 'going'
                ? 'No upcoming shows marked yet.'
                : 'No past shows marked yet.'}
            </p>
            <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
              Tap <span className="text-white">Going</span> or{' '}
              <span className="text-white">Been</span> on any show listing in Discover or on a venue
              page.
            </p>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="mt-6 px-5 py-2.5 rounded-lg bg-momentum-flare/20 border border-momentum-flare/40 text-momentum-flare hover:bg-momentum-flare/30 transition-colors"
            >
              Browse shows
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((mark) => (
              <ShowMarkRow key={mark.jambase_event_id} mark={mark} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
