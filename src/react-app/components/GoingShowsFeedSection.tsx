import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, ExternalLink, Loader2, Ticket, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import SectionHeading from '@/react-app/components/SectionHeading';
import ShowMarkButtons from '@/react-app/components/ShowMarkButtons';
import { HOME_FEED_CAROUSEL_BLEED, HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';
import { jamBaseEventTicketUrl } from '@/shared/jambase-events';
import { isUpcomingShowMark, showMarkToJamBaseEvent, type UserShowMark } from '@/shared/show-marks';

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
  jbEvent,
}: {
  friend: FriendGoingGroup;
  mark: UserShowMark;
  jbEvent?: Record<string, unknown>;
}) {
  const navigate = useNavigate();
  const name = friend.display_name?.trim() || 'Friend';
  const title =
    mark.event_title?.trim() ||
    [mark.artist_name, mark.venue_name].filter(Boolean).join(' at ') ||
    'Show';
  const event = jbEvent ?? showMarkToJamBaseEvent(mark);
  const ticketUrl = jamBaseEventTicketUrl(event);

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-4 h-full flex flex-col min-h-[200px]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => navigate(`/users/${friend.mocha_user_id}`)}
          className="flex items-center gap-2 min-w-0 text-left hover:opacity-90"
        >
          {friend.profile_image_url ? (
            <img
              src={friend.profile_image_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-momentum-flare/20 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-momentum-flare" />
            </div>
          )}
          <span className="text-sm text-momentum-glacier/90 truncate">
            <span className="font-medium text-white">{name}</span>
          </span>
        </button>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-momentum-flare/40 bg-momentum-flare/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-momentum-flare">
          <Check className="w-3 h-3" aria-hidden />
          Going
        </span>
      </div>
      <p className="font-semibold text-white leading-snug line-clamp-2 flex-1">{title}</p>
      {mark.venue_name ? (
        <p className="text-xs text-gray-400 mt-2 truncate">{mark.venue_name}</p>
      ) : null}
      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5" />
        {formatShowDate(mark.start_date)}
      </p>
      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
        <ShowMarkButtons event={event} compact className="w-full" />
        {ticketUrl ? (
          <a
            href={ticketUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 momentum-ticket-btn text-xs font-semibold whitespace-nowrap hover:scale-[1.02] transition-transform tap-feedback"
          >
            <Ticket className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Buy tickets
            <ExternalLink className="w-3 h-3 shrink-0 opacity-80" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function GoingShowsFeedSection() {
  const { user, isPending } = useAuth();
  const [friends, setFriends] = useState<FriendGoingGroup[]>([]);
  const [eventsByEventId, setEventsByEventId] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const friendsRes = await fetch('/api/shows/friends-going?limit=40', {
        credentials: 'include',
      });

      if (friendsRes.ok) {
        const data = (await friendsRes.json()) as {
          friends?: FriendGoingGroup[];
          eventsByEventId?: Record<string, Record<string, unknown>>;
        };
        setFriends(Array.isArray(data.friends) ? data.friends : []);
        setEventsByEventId(
          data.eventsByEventId && typeof data.eventsByEventId === 'object'
            ? data.eventsByEventId
            : {},
        );
      } else {
        setFriends([]);
        setEventsByEventId({});
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

  if (!user || isPending) return null;

  if (loading) {
    return (
      <div className={`${HOME_FEED_SECTION_CLASS} flex justify-center py-8`}>
        <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (friendCards.length === 0) {
    return null;
  }

  return (
    <div className={`${HOME_FEED_SECTION_CLASS} space-y-10`}>
      {friendCards.length > 0 ? (
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
                <FriendGoingCard
                  friend={friend}
                  mark={mark}
                  jbEvent={eventsByEventId[mark.jambase_event_id]}
                />
              </HorizontalClipCarouselItem>
            ))}
          </HorizontalClipCarousel>
        </section>
      ) : null}
    </div>
  );
}
