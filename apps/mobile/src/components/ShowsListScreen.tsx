import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { fetchNearbyShows, fetchTonightShows } from '@/src/lib/api/clips';
import type { ShowEvent } from '@/src/lib/api/types';
import { primeLocationOnUserGesture } from '@/src/lib/location';
import {
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
} from '@shared/jambase-events';
import { jamBaseEventTitle } from '@shared/event-title';
import { colors, spacing, typography } from '@/src/theme/tokens';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function eventTitle(event: ShowEvent): string {
  return (
    jamBaseEventTitle(event as Record<string, unknown>) ||
    asText(event.title) ||
    asText(event.name) ||
    [asText(event.artist_name), eventVenue(event)].filter(Boolean).join(' @ ') ||
    'Show'
  );
}

function eventVenue(event: ShowEvent): string {
  const flat = asText(event.venue_name);
  if (flat) return flat;
  if (event.location && typeof event.location === 'object') {
    const venue = jamBaseEventVenueName(event as Record<string, unknown>);
    const city = jamBaseEventVenueCityLine(event as Record<string, unknown>);
    return [venue !== 'Venue TBA' ? venue : '', city].filter(Boolean).join(' · ');
  }
  return asText(event.location);
}

function eventSubtitle(event: ShowEvent): string {
  const when = asText(event.start_date) || asText(event.startDate);
  const venue = eventVenue(event);
  return [when, venue].filter(Boolean).join(' · ');
}

type Mode = 'nearby' | 'tonight';

function ShowsScreen({ mode }: { mode: Mode }) {
  const [events, setEvents] = useState<ShowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const location = await primeLocationOnUserGesture();
    if (!location.granted || !location.coords) {
      throw new Error('Location permission is required for nearby shows.');
    }
    const result =
      mode === 'nearby'
        ? await fetchNearbyShows({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          })
        : await fetchTonightShows({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
    setEvents(result.events ?? []);
    setNotice(result.jambaseNotice ?? null);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load shows');
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
      <Stack.Screen options={{ title: mode === 'nearby' ? 'Nearby shows' : 'Tonight' }} />
      {loading ? (
        <ActivityIndicator color={colors.ember} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, index) =>
            String(item.id ?? `${eventTitle(item)}-${index}`)
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.ember}
              onRefresh={() => {
                setRefreshing(true);
                void load()
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : 'Refresh failed'),
                  )
                  .finally(() => setRefreshing(false));
              }}
            />
          }
          ListHeaderComponent={
            notice ? <Text style={styles.notice}>{notice}</Text> : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? 'No shows found.'}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.title}>{eventTitle(item)}</Text>
              {eventSubtitle(item) ? (
                <Text style={styles.subtitle}>{eventSubtitle(item)}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

export function NearbyShowsScreen() {
  return <ShowsScreen mode="nearby" />;
}

export function TonightShowsScreen() {
  return <ShowsScreen mode="tonight" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.shellBg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  notice: { ...typography.caption, marginBottom: spacing.md },
  empty: { ...typography.body, textAlign: 'center', marginTop: spacing.xxl },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.shellBorder,
    gap: 4,
  },
  title: { ...typography.body, color: colors.textBody, fontWeight: '600' },
  subtitle: { ...typography.caption },
});
