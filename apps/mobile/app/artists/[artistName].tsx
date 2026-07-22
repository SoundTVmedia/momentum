import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { EntityHero, parseSocialLinks, SocialLinksRow } from '@/src/components/EntityHero';
import { HorizontalClipCarousel } from '@/src/components/HorizontalClipCarousel';
import { HorizontalShowCarousel } from '@/src/components/ShowCarousels';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  fetchArtistPage,
  fetchJamBaseEventsByArtistName,
  type ArtistPagePayload,
} from '@/src/lib/api/clips';
import {
  artistFollowTarget,
  fetchFollowingIds,
  toggleFollowTarget,
} from '@/src/lib/api/follow';
import type { ClipFeedItem, ShowEvent } from '@/src/lib/api/types';
import { venuePath } from '@shared/app-paths';
import { jamBaseEventVenueName } from '@shared/jambase-events';
import { colors, spacing, typography } from '@/src/theme/tokens';

function tourDatesToEvents(
  tourDates: ArtistPagePayload['tourDates'],
  artistImageUrl?: string | null,
): ShowEvent[] {
  return tourDates.map((d) => ({
    id: String(d.id),
    title: d.venue_name ? `Show at ${d.venue_name}` : 'Upcoming show',
    name: d.venue_name ? `Show at ${d.venue_name}` : 'Upcoming show',
    venue_name: d.venue_name ?? undefined,
    location: d.venue_location || [d.city, d.country].filter(Boolean).join(', ') || undefined,
    start_date: d.date,
    startDate: d.date,
    image: artistImageUrl ?? undefined,
    image_url: artistImageUrl ?? undefined,
  }));
}

export default function ArtistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ artistName: string }>();
  const artistSlug = Array.isArray(params.artistName)
    ? params.artistName[0]
    : params.artistName;

  const [data, setData] = useState<ArtistPagePayload | null>(null);
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
    if (!artistSlug) throw new Error('Missing artist');
    const payload = await fetchArtistPage(artistSlug);
    if (!payload.artist?.name?.trim()) {
      throw new Error('Artist not found');
    }
    setData(payload);
    setError(null);
    try {
      const jb = await fetchJamBaseEventsByArtistName(payload.artist.name, 12);
      setJbEvents(jb.events ?? []);
    } catch {
      setJbEvents([]);
    }
  }, [artistSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artist');
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
    if (!user || !data?.artist) {
      setFollowing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = await fetchFollowingIds();
        if (cancelled) return;
        const target = artistFollowTarget(data.artist!.id);
        const nameKey = `artist-name:${data.artist!.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
        setFollowing(ids.includes(target) || ids.includes(nameKey));
      } catch {
        if (!cancelled) setFollowing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, data?.artist?.id, data?.artist?.name]);

  const clips = data?.clips ?? [];
  const upcoming = useMemo(() => {
    if (jbEvents.length > 0) return jbEvents;
    return tourDatesToEvents(data?.tourDates ?? [], data?.artist?.image_url);
  }, [jbEvents, data?.tourDates, data?.artist?.image_url]);
  const social = useMemo(
    () => parseSocialLinks(data?.artist?.social_links),
    [data?.artist?.social_links],
  );

  const onToggleFollow = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!data?.artist) return;
    setFollowBusy(true);
    try {
      const result = await toggleFollowTarget(artistFollowTarget(data.artist.id), {
        artist_name: data.artist.name,
      });
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
        <Stack.Screen options={{ title: 'Artist' }} />
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  if (error || !data?.artist) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Artist' }} />
        <Text style={styles.error}>{error ?? 'Artist not found'}</Text>
        <Pressable style={styles.retry} onPress={() => router.push('/discover')}>
          <Text style={styles.retryLabel}>Search on Discover</Text>
        </Pressable>
      </View>
    );
  }

  const artist = data.artist;
  const ticketUrl = data.tourDates.find((d) => d.ticket_url?.trim())?.ticket_url;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: artist.name }} />
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
          variant="artist"
          name={artist.name}
          imageUrl={artist.image_url}
          bio={artist.bio}
          verified={artist.is_verified === 1}
          showFollow
          following={following}
          followLoading={followBusy}
          onToggleFollow={() => void onToggleFollow()}
        />
        <SocialLinksRow links={social} />

        {ticketUrl ? (
          <Pressable
            style={styles.ticketBtn}
            onPress={() => void Linking.openURL(ticketUrl)}
          >
            <Text style={styles.ticketLabel}>Get Tickets</Text>
          </Pressable>
        ) : null}

        <HorizontalClipCarousel
          title="Latest Concert Moments"
          subtitle="Fan-captured moments from live shows"
          clips={clips}
          onPressClip={(clip) => setPlayer({ clip, clips })}
          emptyMessage={`Nothing here yet — drop the first clip from ${artist.name}.`}
        />

        <HorizontalShowCarousel
          title="Upcoming Shows"
          subtitle={
            jbEvents.length > 0 || data.jambase_attribution
              ? 'Live dates from JamBase'
              : 'Upcoming tour dates'
          }
          events={upcoming}
          emptyMessage="No upcoming shows listed yet."
          onPressEvent={(event) => {
            const venue =
              (typeof event.venue_name === 'string' && event.venue_name.trim()) ||
              (event.location && typeof event.location === 'object'
                ? jamBaseEventVenueName(event as Record<string, unknown>)
                : '') ||
              '';
            if (venue && venue !== 'Venue TBA') {
              router.push(venuePath(venue) as `/venues/${string}`);
            }
          }}
        />
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
  ticketBtn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.flare,
    alignItems: 'center',
  },
  ticketLabel: { color: colors.textBody, fontWeight: '700', fontSize: 15 },
});
