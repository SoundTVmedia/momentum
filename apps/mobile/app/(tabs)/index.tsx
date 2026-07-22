import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { HomeSearchBar } from '@/src/components/HomeSearchBar';
import { HorizontalClipCarousel } from '@/src/components/HorizontalClipCarousel';
import {
  HorizontalMarkCarousel,
  HorizontalShowCarousel,
} from '@/src/components/ShowCarousels';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  fetchClipsPage,
  fetchFavoriteArtistFeed,
  fetchFriendsGoing,
  fetchMyGoingShowMarks,
  fetchNearbyShows,
  fetchTonightShows,
} from '@/src/lib/api/clips';
import type {
  ClipFeedItem,
  FriendGoingGroup,
  ShowEvent,
  UserShowMark,
} from '@/src/lib/api/types';
import { primeLocationOnUserGesture } from '@/src/lib/location';
import { artistPath, venuePath } from '@shared/app-paths';
import { jamBaseEventVenueName } from '@shared/jambase-events';
import { colors, spacing, typography } from '@/src/theme/tokens';

type SortBy = 'latest' | 'most_liked' | 'most_viewed';

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'latest', label: 'Latest' },
  { value: 'most_liked', label: 'Most liked' },
  { value: 'most_viewed', label: 'Most viewed' },
];

function isUpcomingMark(mark: UserShowMark): boolean {
  if (!mark.start_date?.trim()) return true;
  const start = Date.parse(mark.start_date);
  if (!Number.isFinite(start)) return true;
  // Match Cap: still show shows that started recently (within ~4h).
  return start > Date.now() - 4 * 60 * 60 * 1000;
}

type PlayerState = {
  clip: ClipFeedItem;
  clips: ClipFeedItem[];
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [sceneClips, setSceneClips] = useState<ClipFeedItem[]>([]);
  const [favoriteClips, setFavoriteClips] = useState<ClipFeedItem[]>([]);
  const [tonight, setTonight] = useState<ShowEvent[]>([]);
  const [nearby, setNearby] = useState<ShowEvent[]>([]);
  const [goingMarks, setGoingMarks] = useState<UserShowMark[]>([]);
  const [goingEnriched, setGoingEnriched] = useState<Record<string, unknown>[]>(
    [],
  );
  const [friendsGoing, setFriendsGoing] = useState<FriendGoingGroup[]>([]);
  const [friendsEventsById, setFriendsEventsById] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);

  const load = useCallback(async () => {
    const location = await primeLocationOnUserGesture();
    const coords = location.coords;

    const scenePromise = fetchClipsPage({ page: 1, limit: 24, sortBy });
    const favoritesPromise = user
      ? fetchFavoriteArtistFeed({ clipsLimit: 24 }).catch(() => ({ clips: [] }))
      : Promise.resolve({ clips: [] as ClipFeedItem[] });
    const tonightPromise = coords
      ? fetchTonightShows({
          latitude: coords.latitude,
          longitude: coords.longitude,
          limit: 12,
        }).catch(() => ({ events: [] as ShowEvent[] }))
      : Promise.resolve({ events: [] as ShowEvent[] });
    const nearbyPromise = coords
      ? fetchNearbyShows({
          latitude: coords.latitude,
          longitude: coords.longitude,
          limit: 12,
        }).catch(() => ({ events: [] as ShowEvent[] }))
      : Promise.resolve({ events: [] as ShowEvent[] });
    const goingPromise = user
      ? fetchMyGoingShowMarks().catch(() => ({
          marks: [] as UserShowMark[],
          events: [] as Record<string, unknown>[],
        }))
      : Promise.resolve({
          marks: [] as UserShowMark[],
          events: [] as Record<string, unknown>[],
        });
    const friendsPromise = user
      ? fetchFriendsGoing().catch(() => ({
          friends: [] as FriendGoingGroup[],
          eventsByEventId: {} as Record<string, Record<string, unknown>>,
        }))
      : Promise.resolve({
          friends: [] as FriendGoingGroup[],
          eventsByEventId: {} as Record<string, Record<string, unknown>>,
        });

    const [scene, favorites, tonightRes, nearbyRes, goingRes, friendsRes] =
      await Promise.all([
        scenePromise,
        favoritesPromise,
        tonightPromise,
        nearbyPromise,
        goingPromise,
        friendsPromise,
      ]);

    setSceneClips(scene.clips);
    setFavoriteClips(favorites.clips ?? []);
    setTonight(tonightRes.events ?? []);
    setNearby(nearbyRes.events ?? []);
    setGoingMarks(goingRes.marks ?? []);
    setGoingEnriched(goingRes.events ?? []);
    setFriendsGoing(friendsRes.friends ?? []);
    setFriendsEventsById(friendsRes.eventsByEventId ?? {});
  }, [sortBy, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load home feed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const openShowEvent = (event: ShowEvent) => {
    const venue =
      (typeof event.venue_name === 'string' && event.venue_name.trim()) ||
      (event.location && typeof event.location === 'object'
        ? jamBaseEventVenueName(event as Record<string, unknown>)
        : '') ||
      '';
    if (venue && venue !== 'Venue TBA') {
      router.push(venuePath(venue) as `/venues/${string}`);
      return;
    }
    const artist =
      (typeof event.artist_name === 'string' && event.artist_name.trim()) ||
      null;
    if (artist) {
      router.push(artistPath(artist) as `/artists/${string}`);
    }
  };

  const goingUpcoming = goingMarks.filter(isUpcomingMark);

  const goingEventsById = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {};
    const len = Math.min(goingMarks.length, goingEnriched.length);
    for (let i = 0; i < len; i++) {
      const id = goingMarks[i]?.jambase_event_id;
      if (id) map[id] = goingEnriched[i];
    }
    for (const ev of goingEnriched) {
      const id = typeof ev.identifier === 'string' ? ev.identifier.trim() : '';
      if (id && !map[id]) map[id] = ev;
    }
    return map;
  }, [goingMarks, goingEnriched]);

  const friendCards = useMemo(() => {
    const cards: Array<{ mark: UserShowMark; friendName: string }> = [];
    for (const friend of friendsGoing) {
      for (const mark of friend.marks) {
        if (!isUpcomingMark(mark)) continue;
        cards.push({
          mark,
          friendName: friend.display_name?.trim() || 'Friend',
        });
      }
    }
    return cards;
  }, [friendsGoing]);

  const friendMarks = friendCards.map((c) => c.mark);
  const friendNameByEventId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const card of friendCards) {
      map[card.mark.jambase_event_id] = card.friendName;
    }
    return map;
  }, [friendCards]);

  if (loading && sceneClips.length === 0 && favoriteClips.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.ember}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Feedback</Text>
          <Text style={styles.tagline}>Live moments from the scene</Text>
          <HomeSearchBar
            onSelectClip={(clip, feed) => setPlayer({ clip, clips: feed })}
          />
          <View style={styles.links}>
            <Link href="/discover" asChild>
              <Pressable style={styles.chip}>
                <Text style={styles.chipLabel}>Discover</Text>
              </Pressable>
            </Link>
            <Link href="/browse/shows/nearby" asChild>
              <Pressable style={styles.chip}>
                <Text style={styles.chipLabel}>Nearby</Text>
              </Pressable>
            </Link>
            <Link href="/browse/shows/tonight" asChild>
              <Pressable style={styles.chip}>
                <Text style={styles.chipLabel}>Tonight</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {user ? (
          <HorizontalClipCarousel
            title="Your Favorites"
            subtitle="Clips from your favorite artists and people you follow"
            clips={favoriteClips}
            onPressClip={(clip) => setPlayer({ clip, clips: favoriteClips })}
            emptyMessage="Add favorite artists on web/Cap to personalize this row."
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>From The Scene</Text>
          <Text style={styles.sectionSubtitle}>
            Fresh concert clips from everywhere
          </Text>
          <View style={styles.filters}>
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSortBy(option.value)}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      active && styles.filterLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <HorizontalClipCarousel
          title=""
          clips={sceneClips}
          onPressClip={(clip) => setPlayer({ clip, clips: sceneClips })}
          emptyMessage="No clips yet."
        />

        <HorizontalShowCarousel
          title="Shows Tonight"
          subtitle="Happening near you today"
          events={tonight}
          emptyMessage="Allow location to see shows tonight near you."
          onPressEvent={openShowEvent}
        />

        <HorizontalShowCarousel
          title="Upcoming Shows"
          subtitle={
            user
              ? 'Upcoming shows at venues near you'
              : 'Upcoming shows at venues near you from JamBase'
          }
          events={nearby}
          emptyMessage="Allow location to see upcoming nearby shows."
          onPressEvent={openShowEvent}
        />

        {user ? (
          <HorizontalMarkCarousel
            title="Shows you’re going to"
            marks={goingUpcoming}
            eventsByEventId={goingEventsById}
            emptyMessage="Mark a show as Going to see it here."
            onPressMark={(mark) => {
              if (mark.venue_name) {
                router.push(venuePath(mark.venue_name) as `/venues/${string}`);
              } else if (mark.artist_name) {
                router.push(artistPath(mark.artist_name) as `/artists/${string}`);
              }
            }}
          />
        ) : null}

        {user ? (
          <HorizontalMarkCarousel
            title="Friends going"
            subtitle="Upcoming shows your follows marked Going"
            marks={friendMarks}
            eventsByEventId={friendsEventsById}
            emptyMessage="Follow people to see where they’re headed."
            subtitleForMark={(mark) => {
              const friend = friendNameByEventId[mark.jambase_event_id];
              const venue = mark.venue_name?.trim();
              return [friend, venue].filter(Boolean).join(' · ') || friend;
            }}
            onPressMark={(mark) => {
              if (mark.venue_name) {
                router.push(venuePath(mark.venue_name) as `/venues/${string}`);
              } else if (mark.artist_name) {
                router.push(artistPath(mark.artist_name) as `/artists/${string}`);
              }
            }}
          />
        ) : null}
      </ScrollView>

      <ClipPlayerModal
        clip={player?.clip ?? null}
        clips={player?.clips}
        visible={player != null}
        onClose={() => setPlayer(null)}
        onChangeClip={(clip) =>
          setPlayer((prev) => (prev ? { ...prev, clip } : null))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.shellBg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.shellBg,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  brand: {
    ...typography.brand,
    fontSize: 32,
  },
  tagline: {
    ...typography.body,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  chipLabel: {
    color: colors.textBody,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 20,
  },
  sectionSubtitle: {
    ...typography.caption,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  filterChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: colors.glassBorderAccent,
  },
  filterLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: colors.textBody,
  },
});
