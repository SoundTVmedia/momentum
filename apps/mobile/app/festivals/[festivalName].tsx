import { useCallback, useEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { EntityHero } from '@/src/components/EntityHero';
import { HorizontalClipCarousel } from '@/src/components/HorizontalClipCarousel';
import { fetchFestivalPage } from '@/src/lib/api/clips';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { artistPath, venuePath } from '@shared/app-paths';
import { formatFestivalDateRange } from '@shared/jambase-festival';
import { colors, spacing, typography } from '@/src/theme/tokens';

const ARTIST_FALLBACK =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

export default function FestivalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ festivalName: string }>();
  const festivalSlug = Array.isArray(params.festivalName)
    ? params.festivalName[0]
    : params.festivalName;

  const [data, setData] = useState<Awaited<ReturnType<typeof fetchFestivalPage>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<{
    clip: ClipFeedItem;
    clips: ClipFeedItem[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!festivalSlug) throw new Error('Missing festival');
    const payload = await fetchFestivalPage(festivalSlug);
    if (!payload.festival?.name?.trim()) {
      throw new Error('Festival not found');
    }
    setData(payload);
    setError(null);
  }, [festivalSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load festival');
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

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Festival' }} />
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  if (error || !data?.festival) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Festival' }} />
        <Text style={styles.error}>{error ?? 'Festival not found'}</Text>
        <Pressable style={styles.retry} onPress={() => router.push('/discover')}>
          <Text style={styles.retryLabel}>Search on Discover</Text>
        </Pressable>
      </View>
    );
  }

  const { festival, artists, clips } = data;
  const dateLabel = formatFestivalDateRange(festival.start_date, festival.end_date);
  const locationLabel = [festival.venue_name, festival.city_line].filter(Boolean).join(' · ');
  const subtitle = [dateLabel, locationLabel].filter(Boolean).join('\n');

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: festival.name }} />
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
          name={festival.name}
          imageUrl={festival.image_url}
          subtitle={subtitle || null}
        />

        <View style={styles.actions}>
          {festival.ticket_url ? (
            <Pressable
              style={styles.ticketBtn}
              onPress={() => void Linking.openURL(festival.ticket_url!)}
            >
              <Text style={styles.ticketLabel}>Get Tickets</Text>
            </Pressable>
          ) : null}
          {festival.website_url ? (
            <Pressable
              style={styles.webBtn}
              onPress={() => void Linking.openURL(festival.website_url!)}
            >
              <Text style={styles.webLabel}>Festival website</Text>
            </Pressable>
          ) : null}
          {festival.venue_name ? (
            <Pressable
              onPress={() =>
                router.push(venuePath(festival.venue_name) as `/venues/${string}`)
              }
            >
              <Text style={styles.venueLink}>{locationLabel}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Lineup</Text>
        {artists.length > 0 ? (
          <View style={styles.lineup}>
            {artists.map((artist) => (
              <Pressable
                key={artist.jambase_id ?? artist.name}
                style={styles.artistCard}
                onPress={() => router.push(artistPath(artist.name) as `/artists/${string}`)}
              >
                <Image
                  source={{ uri: artist.image_url?.trim() || ARTIST_FALLBACK }}
                  style={styles.artistImage}
                  contentFit="cover"
                />
                {artist.is_headliner ? (
                  <Text style={styles.headliner}>Headliner</Text>
                ) : null}
                <Text style={styles.artistName} numberOfLines={2}>
                  {artist.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Lineup not listed yet.</Text>
        )}

        <HorizontalClipCarousel
          title="Live Moments"
          subtitle="Fan-captured moments from this festival"
          clips={clips}
          onPressClip={(clip) => setPlayer({ clip, clips })}
          emptyMessage={`Nothing here yet — drop the first clip from ${festival.name}.`}
        />

        {data.jambase_attribution ? (
          <Text style={styles.attribution}>Festival listings powered by JamBase</Text>
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
  actions: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ticketBtn: {
    backgroundColor: colors.flare,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ticketLabel: { color: colors.textBody, fontWeight: '700' },
  webBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  webLabel: { color: colors.textBody, fontWeight: '600' },
  venueLink: { ...typography.caption, color: colors.ember, textAlign: 'center' },
  sectionTitle: {
    ...typography.title,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  lineup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  artistCard: {
    width: '31%',
    marginBottom: spacing.sm,
  },
  artistImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headliner: {
    ...typography.caption,
    color: colors.flare,
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  artistName: {
    ...typography.caption,
    color: colors.textBody,
    marginTop: 4,
    fontWeight: '600',
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  attribution: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
});
