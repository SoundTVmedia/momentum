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
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { listOutboxJobs, readCaptureHandoff, runOutboxJob } from '@/src/lib/upload/outbox';
import type { OutboxJob } from '@/src/lib/upload/multipart';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function UploadQueueScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<OutboxJob[]>([]);
  const [pendingCapture, setPendingCapture] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextJobs, handoff] = await Promise.all([
      listOutboxJobs(),
      readCaptureHandoff(),
    ]);
    setJobs(nextJobs);
    setPendingCapture(Boolean(handoff));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Pending capture recovery — bounce to review
  useEffect(() => {
    if (pendingCapture) {
      router.push('/upload');
    }
  }, [pendingCapture, router]);

  if (!isLoading && !user) {
    return <Redirect href="/auth" />;
  }

  const retry = async (id: string) => {
    setRunningId(id);
    try {
      await runOutboxJob(id, (job) => {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
      });
      await reload();
    } catch {
      await reload();
    } finally {
      setRunningId(null);
    }
  };

  return (
    <View style={styles.root}>
      {loading ? (
        <ActivityIndicator color={colors.ember} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.ember}
              onRefresh={() => {
                setRefreshing(true);
                void reload().finally(() => setRefreshing(false));
              }}
            />
          }
          ListHeaderComponent={
            <Text style={styles.hint}>
              Uploads run through the existing Worker multipart API. Capacitor queue
              remains production until cutover.
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No uploads in the queue.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.title}>{item.form.artist_name || item.fileName}</Text>
              <Text style={styles.meta}>
                {item.status}
                {item.progress > 0 ? ` · ${item.progress}%` : ''}
                {item.clipId ? ` · clip #${item.clipId}` : ''}
              </Text>
              {item.error ? <Text style={styles.error}>{item.error}</Text> : null}
              {(item.status === 'failed' || item.status === 'queued' || item.status === 'paused') && (
                <Pressable
                  style={styles.retry}
                  disabled={runningId === item.id}
                  onPress={() => void retry(item.id)}
                >
                  {runningId === item.id ? (
                    <ActivityIndicator color={colors.textBody} />
                  ) : (
                    <Text style={styles.retryLabel}>
                      {item.status === 'failed' ? 'Retry' : 'Upload now'}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.shellBg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  hint: { ...typography.caption, marginBottom: spacing.md, lineHeight: 18 },
  empty: { ...typography.body, textAlign: 'center', marginTop: spacing.xxl },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.shellBorder,
    gap: 4,
  },
  title: { ...typography.body, color: colors.textBody, fontWeight: '600' },
  meta: { ...typography.caption },
  error: { color: colors.danger, fontSize: 13 },
  retry: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.flare,
  },
  retryLabel: { color: colors.textBody, fontWeight: '700' },
});
