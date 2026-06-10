import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import SectionHeading from '@/react-app/components/SectionHeading';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';

type RecommendedPayload = {
  events?: Record<string, unknown>[];
  message?: string;
};

export default function BeenHistoryShowsSection() {
  const { user, isPending } = useAuth();
  const [recommended, setRecommended] = useState<RecommendedPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRecommended(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/personalization/concerts/recommended?limit=12', {
        credentials: 'include',
      });
      if (res.ok) {
        setRecommended((await res.json()) as RecommendedPayload);
      } else {
        setRecommended(null);
      }
    } catch (e) {
      console.error('BeenHistoryShowsSection load failed', e);
      setRecommended(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isPending) return;
    void load();
  }, [isPending, load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener(SHOW_MARKS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SHOW_MARKS_CHANGED_EVENT, refresh);
  }, [load]);

  if (!user || isPending) return null;

  if (loading) {
    return (
      <div className={`${HOME_FEED_SECTION_CLASS} flex justify-center py-8`}>
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
      </div>
    );
  }

  const recEvents = recommended?.events ?? [];
  if (recEvents.length === 0) return null;

  return (
    <section className={HOME_FEED_SECTION_CLASS}>
      <SectionHeading
        title="Because you've been to…"
        subtitle="Upcoming shows from artists you've marked as Went"
        size="section"
      />
      <JamBaseEventGrid
        preloadedEvents={recEvents}
        maxEvents={recEvents.length}
        layout="carousel"
        carouselAriaLabel="Recommended shows from your history"
        carouselClassName={HOME_FEED_CAROUSEL_BLEED}
      />
    </section>
  );
}
