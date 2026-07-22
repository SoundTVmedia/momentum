import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { ClipFeedGrid } from '@/src/components/ClipFeedGrid';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { fetchDiscoverFeed } from '@/src/lib/api/clips';
import type { ClipFeedItem, ShowEvent } from '@/src/lib/api/types';
import { colors, spacing, typography } from '@/src/theme/tokens';

type DiscoverArtist = { name: string; clip_count?: number };

function eventTitle(event: ShowEvent): string {
  return (
    event.title?.trim() ||
    event.name?.trim() ||
    [event.artist_name, event.venue_name].filter(Boolean).join(' @ ') ||
    'Show'
  );
}

export default function DiscoverScreen() {
  const [clips, setClips] = useState<ClipFeedItem[]>([]);
  const [events, setEvents] = useState<ShowEvent[]>([]);
  const [artists, setArtists] = useState<DiscoverArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<ClipFeedItem | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchDiscoverFeed();
    setClips(result.clips ?? []);
    setEvents(result.nearbyEvents ?? []);
    setArtists(result.artists ?? []);
    setLocationLabel(result.location?.label ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load discover');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Discover' }} />
      <ClipFeedGrid
        clips={clips}
        loading={loading}
        refreshing={refreshing}
        loadingMore={false}
        error={error}
        emptyMessage="Nothing to discover right now."
        onRefresh={() => {
          setRefreshing(true);
          void load()
            .catch((err) =>
              setError(err instanceof Error ? err.message : 'Refresh failed'),
            )
            .finally(() => setRefreshing(false));
        }}
        onEndReached={() => undefined}
        onPressClip={setActiveClip}
        ListHeaderComponent={
          <View style={styles.header}>
            {locationLabel ? (
              <Text style={styles.meta}>Near {locationLabel}</Text>
            ) : null}
            {artists.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Artists</Text>
                <FlatList
                  horizontal
                  data={artists.slice(0, 12)}
                  keyExtractor={(item, index) => `${item.name}-${index}`}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.artistChip}>
                      <Text style={styles.artistName}>{item.name}</Text>
                    </View>
                  )}
                />
              </View>
            ) : null}
            {events.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nearby shows</Text>
                {events.slice(0, 5).map((event, index) => (
                  <Text key={`${eventTitle(event)}-${index}`} style={styles.event}>
                    {eventTitle(event)}
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>Trending clips</Text>
          </View>
        }
      />
      <ClipPlayerModal
        clip={activeClip}
        clips={clips}
        visible={activeClip != null}
        onClose={() => setActiveClip(null)}
        onChangeClip={setActiveClip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.shellBg },
  header: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  meta: { ...typography.caption },
  section: { gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { ...typography.label, marginTop: spacing.sm },
  artistChip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  artistName: { color: colors.textBody, fontWeight: '600', fontSize: 13 },
  event: { ...typography.body, color: colors.textSecondary },
});
