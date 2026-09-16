import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import PastShowsCarousel, { type PastShowSummary } from '@/react-app/components/PastShowsCarousel';
import SectionHeading from '@/react-app/components/SectionHeading';
import { MY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';
import { useAppPullRefresh } from '@/react-app/hooks/useAppPullRefresh';
import {
  isProfilePastShowMark,
  partitionShowMarksForLists,
  userShowMarkToPastShowSummary,
  type UserShowMark,
} from '@/shared/show-marks';

type ProfilePastShowsSectionProps = {
  userId: string;
  isOwnProfile: boolean;
  displayName?: string | null;
  className?: string;
};

function cardsFromMarks(marks: UserShowMark[]): PastShowSummary[] {
  const { attended } = partitionShowMarksForLists(marks);
  return attended
    .filter((mark) => isProfilePastShowMark(mark))
    .sort((a, b) => {
      const aDate = a.start_date?.trim() || '';
      const bDate = b.start_date?.trim() || '';
      if (aDate && bDate) return bDate.localeCompare(aDate);
      if (aDate) return -1;
      if (bDate) return 1;
      return 0;
    })
    .map(userShowMarkToPastShowSummary);
}

export default function ProfilePastShowsSection({
  userId,
  isOwnProfile,
  displayName,
  className = '',
}: ProfilePastShowsSectionProps) {
  const [shows, setShows] = useState<PastShowSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) {
        setShows([]);
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const attendedRes = await fetch(`/api/users/${encodeURIComponent(userId)}/attended-shows`, {
          credentials: 'include',
        });
        const attendedType = attendedRes.headers.get('content-type') || '';
        if (attendedRes.ok && attendedType.includes('application/json')) {
          const data = (await attendedRes.json()) as { shows?: PastShowSummary[] };
          if (Array.isArray(data.shows)) {
            setShows(data.shows);
            return;
          }
        }

        if (isOwnProfile) {
          const meRes = await fetch('/api/users/me/show-marks?status=attended', {
            credentials: 'include',
          });
          if (!meRes.ok) {
            if (!opts?.silent) setShows([]);
            return;
          }
          const data = (await meRes.json()) as { marks?: UserShowMark[] };
          setShows(cardsFromMarks(Array.isArray(data.marks) ? data.marks : []));
          return;
        }

        if (!opts?.silent) setShows([]);
      } catch (e) {
        console.error('ProfilePastShowsSection load failed', e);
        if (!opts?.silent) setShows([]);
      } finally {
        setLoading(false);
      }
    },
    [isOwnProfile, userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reloadSilent = useCallback(() => load({ silent: true }), [load]);
  useAppPullRefresh(reloadSilent, Boolean(userId));

  useEffect(() => {
    if (!isOwnProfile) return;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (debounceId != null) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        void load();
      }, 400);
    };
    window.addEventListener(SHOW_MARKS_CHANGED_EVENT, refresh);
    return () => {
      if (debounceId != null) clearTimeout(debounceId);
      window.removeEventListener(SHOW_MARKS_CHANGED_EVENT, refresh);
    };
  }, [isOwnProfile, load]);

  const title = isOwnProfile ? 'My Past Shows' : 'Past Shows';
  const subtitle = useMemo(() => {
    if (isOwnProfile) return "Shows you've gone to";
    const name = displayName?.trim();
    return name ? `Shows ${name} has gone to` : "Shows they've gone to";
  }, [displayName, isOwnProfile]);

  if (loading) {
    return (
      <div className={`mb-10 flex justify-center py-8 ${className}`}>
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (shows.length === 0) return null;

  return (
    <section className={`mb-10 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <SectionHeading title={title} subtitle={subtitle} size="section" className="mb-0" />
        {isOwnProfile ? (
          <Link to={MY_SHOWS_PATH} className="text-sm text-momentum-flare hover:text-momentum-flare/80">
            Manage my shows
          </Link>
        ) : null}
      </div>
      <PastShowsCarousel shows={shows} variant="user" />
    </section>
  );
}
