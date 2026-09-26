import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import { Button, Section } from '@/react-app/components/ui';
import { MY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';
import { useAppPullRefresh } from '@/react-app/hooks/useAppPullRefresh';
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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch(
        '/api/users/me/show-marks?status=going&enrich=jambase',
        { credentials: 'include' },
      );
      if (!res.ok) {
        if (!opts?.silent) setEvents([]);
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
      if (!opts?.silent) setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isPending) return;
    void load();
  }, [isPending, load]);

  const reloadSilent = useCallback(() => load({ silent: true }), [load]);
  useAppPullRefresh(reloadSilent, Boolean(user));

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
    <Section
      title={title}
      description="Your upcoming plans — we use these for capture and venue matching"
      className={sectionClass}
      action={
        <Button to={MY_SHOWS_PATH} variant="quiet" size="sm">
          Manage
        </Button>
      }
    >
      <JamBaseEventGrid
        preloadedEvents={events}
        maxEvents={events.length}
        layout="carousel"
        carouselAriaLabel={title}
        carouselClassName={variant === 'home' ? HOME_FEED_CAROUSEL_BLEED : undefined}
      />
    </Section>
  );
}
