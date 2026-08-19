import { useAuth } from '@getmocha/users-service/react';
import { Archive, Calendar, FileVideo, Loader2, MapPin, PenLine, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import SectionHeading from '@/react-app/components/SectionHeading';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';
import type { UserShowMark } from '@/shared/show-marks';

function showTitle(mark: UserShowMark): string {
  return (
    mark.event_title?.trim() ||
    [mark.artist_name, mark.venue_name].filter(Boolean).join(' at ') ||
    'Past show'
  );
}

function showDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ArchivalHubPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const { attendedMarks, loading, hydrated } = useShowMarks();

  const startUpload = (mark?: UserShowMark) => {
    navigate('/upload?archive=true', {
      state: {
        fromPhotoLibrary: true,
        ...(mark
          ? {
              showData: {
                jambase_event_id: mark.jambase_event_id,
                jambase_venue_id: mark.jambase_venue_id ?? undefined,
                jambase_artist_id: mark.jambase_artist_id ?? undefined,
                event_title: mark.event_title ?? undefined,
                artist_name: mark.artist_name ?? undefined,
                venue_name: mark.venue_name ?? undefined,
                location: mark.venue_location ?? undefined,
              },
            }
          : {}),
      },
    });
  };

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeading
          title="Archival Hub"
          subtitle="Bring past concert moments into the show where they belong."
          icon={Archive}
          size="page"
        />

        <section className="mb-12 grid gap-4 md:grid-cols-3">
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <FileVideo className="h-7 w-7 text-momentum-flare" />
            <h2 className="mt-4 font-bold">Choose an old clip</h2>
            <p className="mt-2 text-sm text-gray-400">
              Select a video from your photo library or computer.
            </p>
          </div>
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <Sparkles className="h-7 w-7 text-momentum-rose" />
            <h2 className="mt-4 font-bold">We match the show</h2>
            <p className="mt-2 text-sm text-gray-400">
              Recorded date and location metadata are matched against concluded JamBase shows.
            </p>
          </div>
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <PenLine className="h-7 w-7 text-momentum-ember" />
            <h2 className="mt-4 font-bold">Confirm or add details</h2>
            <p className="mt-2 text-sm text-gray-400">
              If metadata is missing, enter the artist, venue, date, and show details manually.
            </p>
          </div>
        </section>

        {isPending ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-momentum-flare" />
          </div>
        ) : !user ? (
          <div className="glass-highlight rounded-2xl p-8 text-center">
            <p className="text-gray-300">Sign in to upload clips from past shows.</p>
            <Link
              to="/auth"
              className="mt-5 inline-block rounded-xl momentum-grad-interactive px-6 py-3 font-semibold"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-12 text-center">
              <button
                type="button"
                onClick={() => startUpload()}
                className="rounded-xl momentum-grad-interactive px-7 py-3.5 font-semibold"
              >
                Upload an archival clip
              </button>
              <p className="mt-3 text-xs text-gray-500">
                You will review the matched show before publishing.
              </p>
            </div>

            <section>
              <SectionHeading
                title="Shows you attended"
                subtitle="Pick a show first to prefill its JamBase details."
                size="section"
              />
              {!hydrated || loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-momentum-flare" />
                </div>
              ) : attendedMarks.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-gray-300">
                  <p>You have not marked any past shows as Went yet.</p>
                  <Link
                    to="/discover"
                    className="mt-4 inline-block text-momentum-flare hover:text-white"
                  >
                    Find a past show
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {attendedMarks.map((mark) => (
                    <button
                      key={mark.jambase_event_id}
                      type="button"
                      onClick={() => startUpload(mark)}
                      className="glass-panel rounded-xl border border-white/10 p-5 text-left transition-colors hover:border-momentum-flare/50"
                    >
                      <h3 className="font-bold">{showTitle(mark)}</h3>
                      <div className="mt-3 space-y-1.5 text-sm text-gray-400">
                        <p className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {showDate(mark.start_date)}
                        </p>
                        {mark.venue_name ? (
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {mark.venue_name}
                          </p>
                        ) : null}
                      </div>
                      <span className="mt-4 inline-block text-sm font-semibold text-momentum-flare">
                        Upload to this show
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
