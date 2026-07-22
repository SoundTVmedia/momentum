import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { ClipFeedGrid } from '@/src/components/ClipFeedGrid';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { fetchLikedClipsFeed } from '@/src/lib/api/clips';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { colors } from '@/src/theme/tokens';

export default function LikedClipsScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const [clips, setClips] = useState<ClipFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<ClipFeedItem | null>(null);

  const load = useCallback(async () => {
    const result = await fetchLikedClipsFeed();
    setClips(result.clips ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load liked clips');
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
      <Stack.Screen options={{ title: 'Liked' }} />
      <ClipFeedGrid
        clips={clips}
        loading={loading}
        refreshing={refreshing}
        loadingMore={false}
        error={error}
        emptyMessage="No liked clips yet."
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
});
