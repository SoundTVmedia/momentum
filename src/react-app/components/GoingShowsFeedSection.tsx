import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import SectionHeading from '@/react-app/components/SectionHeading';
import { MY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';
import {
  isUpcomingShowMark,
  showMarkToJamBaseEvent,
  type UserShowMark,
} from '@/shared/show-marks';

type FriendGoingGroup = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  marks: UserShowMark[];
};

function formatShowDate(iso: string | null): string {
  if (!iso?.trim()) return 'Date TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function FriendGoingCard({
  friend,
  mark,
}: {
  friend: FriendGoingGroup;
  mark: UserShowMark;
}) {
  const navigate = useNavigate();
  const name = friend.display_name?.trim() || 'Friend';
  const title =
    mark.event_title?.trim() ||
    [mark.artist_name, mark.venue_name].filter(Boolean).join(' at ') ||
    'Show';

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-4 h-full flex flex-col min-h-[168px]">
      <button
        type="button"
        onClick={() => navigate(`/users/${friend.mocha_user_id}`)}
        className="flex items-center gap-2 mb-3 text-left hover:opacity-90"
      >
        {friend.profile_image_url ? (
          <img
            src={friend.profile_image_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-white/20"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-momentum-flare/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-momentum-flare" />
          </div>
        )}
        <span className="text-sm text-momentum-glacier/90 truncate">
          <span className="font-medium text-white">{name}</span> is going
        </span>
      </button>
      <p className="font-semibold text-white leading-snug line-clamp-2 flex-1">{title}</p>
      {mark.venue_name ? (
        <p className="text-xs text-gray-400 mt-2 truncate">{mark.venue_name}</p>
      ) : null}
      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5" />
        {formatShowDate(mark.start_date)}
      </p>
    </div>
  );
}

type RecommendedPayload = {
  events?: Record<string, unknown>[];
  message?: string;
};

export default function GoingShowsFeedSection() {
  const { user, isPending } = useAuth();
  const [myGoing, setMyGoing] = useState<UserShowMark[]>([]);
  const [friends, setFriends] = useState<FriendGoingGroup[]>([]);
  const [recommended, setRecommended] = useState<RecommendedPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setMyGoing([]);
      setFriends([]);
      setRecommended(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [mineRes, friendsRes, recRes] = await Promise.all([
        fetch('/api/users/me/show-marks?status=going', { credentials: 'include' }),
        fetch('/api/shows/friends-going?limit=40', { credentials: 'include' }),
        fetch('/api/personalization/concerts/recommended?limit=12', {
          credentials: 'include',
        }),
      ]);

      if (mineRes.ok) {
        const data = (await mineRes.json()) as { marks?: UserShowMark[] };
        const marks = Array.isArray(data.marks) ? data.marks : [];
        setMyGoing(marks.filter((m) => isUpcomingShowMark(m)));
      } else {
        setMyGoing([]);
      }

      if (friendsRes.ok) {
        const data = (await friendsRes.json()) as { friends?: FriendGoingGroup[] };
        setFriends(Array.isArray(data.friends) ? data.friends : []);
      } else {
        setFriends([]);
      }

      if (recRes.ok) {
        setRecommended((await recRes.json()) as RecommendedPayload);
      } else {
        setRecommended(null);
      }
    } catch (e) {
      console.error('GoingShowsFeedSection load failed', e);
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

  const myEvents = useMemo(
    () => myGoing.map(showMarkToJamBaseEvent),
    [myGoing],
  );

  const friendCards = useMemo(() => {
    const cards: { key: string; friend: FriendGoingGroup; mark: UserShowMark }[] = [];
    for (const friend of friends) {
      for (const mark of friend.marks) {
        if (!isUpcomingShowMark(mark)) continue;
        cards.push({
          key: `${friend.mocha_user_id}:${mark.jambase_event_id}`,
          friend,
          mark,
        });
      }
    }
    return cards;
  }, [friends]);

  const recEvents = recommended?.events ?? [];

  if (!user || isPending) return null;

  if (loading) {
    return (
      <div className={`${HOME_FEED_SECTION_CLASS} flex justify-center py-8`}>
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
      </div>
    );
  }

  const hasMyGoing = myEvents.length > 0;
  const hasFriends = friendCards.length > 0;
  const hasRecommended = recEvents.length > 0;

  if (!hasMyGoing && !hasFriends && !hasRecommended) {
    return null;
  }

  return (
    <div className={`${HOME_FEED_SECTION_CLASS} space-y-10`}>
      {hasMyGoing ? (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <SectionHeading
              title="Shows you're going to"
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
            preloadedEvents={myEvents}
            maxEvents={myEvents.length}
            layout="carousel"
            carouselAriaLabel="Shows you are going to"
            carouselClassName={HOME_FEED_CAROUSEL_BLEED}
          />
        </section>
      ) : null}

      {hasFriends ? (
        <section>
          <SectionHeading
            title="Friends' plans"
            subtitle="Shows people you follow marked as Going"
            size="section"
          />
          <HorizontalClipCarousel
            stretchItems
            ariaLabel="Friends going to shows"
            className={HOME_FEED_CAROUSEL_BLEED}
            filmstrip={false}
          >
            {friendCards.map(({ key, friend, mark }) => (
              <HorizontalClipCarouselItem key={key} mobilePeek="event">
                <FriendGoingCard friend={friend} mark={mark} />
              </HorizontalClipCarouselItem>
            ))}
          </HorizontalClipCarousel>
        </section>
      ) : null}

      {hasRecommended ? (
        <section>
          <SectionHeading
            title="Because you've been to…"
            subtitle="Upcoming shows from artists you've marked as Been"
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
      ) : null}
    </div>
  );
}
