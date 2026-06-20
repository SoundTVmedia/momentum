import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { MY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';
import { upcomingGoingMarkEvents, type UserShowMark } from '@/shared/show-marks';

type MyGoingShowsSectionProps = {
  /** Home feed vs own profile shell */
  variant?: 'home' | 'profile';
  className?: string;
};

export default function MyGoingShowsSection({
  variant = 'home',
  className = '',
}: MyGoingShowsSectionProps) {
  const { user, isPending } = useAuth();
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        '/api/users/me/show-marks?status=going&enrich=jambase',
        { credentials: 'include' },
      );
      if (!res.ok) {
        setEvents([]);
        return;
      }
      const data = (await res.json()) as {
        marks?: UserShowMark[];
        events?: Record<string, unknown>[];
      };
      const marks = Array.isArray(data.marks) ? data.marks : [];
      const enriched = Array.isArray(data.events) ? data.events : undefined;
      setEvents(upcomingGoingMarkEvents(marks, enriched));
    } catch (e) {
      console.error('MyGoingShowsSection load failed', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isPending) return;
    void load();
  }, [isPending, load]);

  useEffect(() => {
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
  }, [load]);

  const title = useMemo(
    () => (variant === 'profile' ? "Shows I'm going to" : "Shows you're going to"),
    [variant],
  );

  if (!user || isPending) return null;

  if (loading) {
    return (
      <div className={`${HOME_FEED_SECTION_CLASS} flex justify-center py-8 ${className}`}>
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (events.length === 0) return null;

  const sectionClass =
    variant === 'profile' ? `mb-10 ${className}` : `${HOME_FEED_SECTION_CLASS} ${className}`;

  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <SectionHeading
          title={title}
          subtitle="Your upcoming plans — we use these for capture and venue matching"
          size="section"
          className="mb-0"
        />
        <Link
          to={MY_SHOWS_PATH}
          className="text-sm text-momentum-flare hover:text-momentum-flare/80"
        >
          Manage my shows
        </Link>
      </div>
      <JamBaseEventGrid
        preloadedEvents={events}
        maxEvents={events.length}
        layout="carousel"
        carouselAriaLabel={title}
        carouselClassName={variant === 'home' ? HOME_FEED_CAROUSEL_BLEED : undefined}
      />
    </section>
  );
}
