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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { EntityHero } from '@/src/components/EntityHero';
import { HorizontalClipCarousel } from '@/src/components/HorizontalClipCarousel';
import { HorizontalShowCarousel } from '@/src/components/ShowCarousels';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  fetchJamBaseEventsByVenueName,
  fetchVenuePage,
  type VenuePagePayload,
} from '@/src/lib/api/clips';
import {
  fetchFollowingIds,
  toggleFollowTarget,
  venueFollowTarget,
} from '@/src/lib/api/follow';
import type { ClipFeedItem, ShowEvent } from '@/src/lib/api/types';
import { artistPath } from '@shared/app-paths';
import { jamBaseEventHeadliner } from '@shared/jambase-events';
import { colors, spacing, typography } from '@/src/theme/tokens';

function venueUpcomingRowToEvent(
  event: VenuePagePayload['upcomingEvents'][number],
  venue: VenuePagePayload['venue'],
  index: number,
): ShowEvent {
  const artistName = event.artist_name?.trim() || null;
  const image = event.artist_image ?? venue.image_url ?? undefined;
  return {
    id: `venue-local:${event.id}:${index}`,
    name: artistName ? `${artistName} at ${venue.name}` : `Show at ${venue.name}`,
    title: artistName ? `${artistName} at ${venue.name}` : `Show at ${venue.name}`,
    artist_name: artistName ?? undefined,
    venue_name: venue.name,
    start_date: event.date,
    startDate: event.date,
    image,
    image_url: image,
    location: [event.city, venue.location].filter(Boolean).join(', ') || undefined,
  };
}

function toShowEvents(
  payload: VenuePagePayload,
  fetchedJb: ShowEvent[],
): ShowEvent[] {
  if (fetchedJb.length > 0) return fetchedJb;
  if (payload.upcomingJamBaseEvents?.length) {
    return payload.upcomingJamBaseEvents as ShowEvent[];
  }
  return payload.upcomingEvents.map((event, index) =>
    venueUpcomingRowToEvent(event, payload.venue, index),
  );
}

export default function VenueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ venueName: string }>();
  const venueSlug = Array.isArray(params.venueName)
    ? params.venueName[0]
    : params.venueName;

  const [data, setData] = useState<VenuePagePayload | null>(null);
  const [jbEvents, setJbEvents] = useState<ShowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<{
    clip: ClipFeedItem;
    clips: ClipFeedItem[];
  } | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!venueSlug) throw new Error('Missing venue');
    const payload = await fetchVenuePage(venueSlug);
    if (!payload.venue?.name?.trim()) {
      throw new Error('Venue not found');
    }
    setData(payload);
    setError(null);
    try {
      const jb = await fetchJamBaseEventsByVenueName(payload.venue.name, 12);
      setJbEvents(jb.events ?? []);
    } catch {
      setJbEvents([]);
    }
  }, [venueSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load venue');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!user || !data?.venue) {
      setFollowing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = await fetchFollowingIds();
        if (cancelled) return;
        setFollowing(ids.includes(venueFollowTarget(data.venue.id)));
      } catch {
        if (!cancelled) setFollowing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, data?.venue?.id]);

  const clips = data?.clips ?? [];
  const upcoming = useMemo(
    () => (data ? toShowEvents(data, jbEvents) : []),
    [data, jbEvents],
  );

  const onToggleFollow = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!data?.venue) return;
    setFollowBusy(true);
    try {
      const result = await toggleFollowTarget(venueFollowTarget(data.venue.id));
      setFollowing(Boolean(result.following));
    } catch {
      /* keep prior */
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Venue' }} />
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  if (error || !data?.venue) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Venue' }} />
        <Text style={styles.error}>{error ?? 'Venue not found'}</Text>
        <Pressable style={styles.retry} onPress={() => router.push('/discover')}>
          <Text style={styles.retryLabel}>Search on Discover</Text>
        </Pressable>
      </View>
    );
  }

  const venue = data.venue;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: venue.name }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load()
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Refresh failed'),
                )
                .finally(() => setRefreshing(false));
            }}
            tintColor={colors.ember}
          />
        }
        contentContainerStyle={styles.content}
      >
        <EntityHero
          variant="venue"
          name={venue.name}
          imageUrl={venue.image_url}
          subtitle={[venue.location, venue.address].filter(Boolean).join(' · ')}
          capacity={venue.capacity}
          showFollow
          following={following}
          followLoading={followBusy}
          onToggleFollow={() => void onToggleFollow()}
        />

        <HorizontalClipCarousel
          title="Live Moments"
          subtitle="Fan-captured moments from shows at this venue"
          clips={clips}
          onPressClip={(clip) => setPlayer({ clip, clips })}
          emptyMessage={`Nothing here yet — drop the first clip from ${venue.name}.`}
        />

        <HorizontalShowCarousel
          title="Upcoming shows"
          subtitle={
            data.jambase_attribution
              ? 'Live dates at this venue from JamBase'
              : 'Upcoming dates at this venue'
          }
          events={upcoming}
          emptyMessage="No upcoming shows listed yet."
          onPressEvent={(event) => {
            const headliner = jamBaseEventHeadliner(event as Record<string, unknown>);
            const artist =
              (typeof event.artist_name === 'string' && event.artist_name) ||
              (typeof headliner?.name === 'string' && headliner.name) ||
              null;
            if (artist) {
              router.push(artistPath(artist) as `/artists/${string}`);
            }
          }}
        />

        {data.jambase_attribution || jbEvents.length > 0 ? (
          <Text style={styles.attribution}>Show listings powered by JamBase</Text>
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
  root: { flex: 1, backgroundColor: colors.shellBg },
  content: { paddingBottom: spacing.xxl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.shellBg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  error: { ...typography.body, textAlign: 'center', color: colors.danger },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.flare,
  },
  retryLabel: { color: colors.textBody, fontWeight: '700' },
  attribution: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
});
