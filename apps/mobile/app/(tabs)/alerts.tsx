import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
} from '@/src/lib/api/clips';
import type { AppNotification } from '@/src/lib/api/types';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function AlertsScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchNotifications();
    setItems(result.notifications);
    setUnread(result.unread_count);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load alerts');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, load]);

  if (!authLoading && !user) {
    return <Redirect href="/auth" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.meta}>
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </Text>
        {unread > 0 ? (
          <Pressable
            onPress={() => {
              void markAllNotificationsRead().then(load);
            }}
          >
            <Text style={styles.action}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.ember} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
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
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? 'No notifications yet.'}</Text>
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.row, !item.is_read && styles.unread]}>
              <Text style={styles.content}>{item.content}</Text>
              <Text style={styles.time}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.shellBg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  meta: {
    ...typography.caption,
  },
  action: {
    color: colors.ember,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.shellBorder,
    gap: 4,
  },
  unread: {
    backgroundColor: colors.glassBg,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  content: {
    ...typography.body,
    color: colors.textBody,
  },
  time: {
    ...typography.caption,
  },
  empty: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
