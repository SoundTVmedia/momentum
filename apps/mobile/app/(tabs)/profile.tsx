import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Redirect } from 'expo-router';
import { ClipPlayerModal } from '@/src/components/ClipPlayerModal';
import { HorizontalClipCarousel } from '@/src/components/HorizontalClipCarousel';
import { HorizontalMarkCarousel } from '@/src/components/ShowCarousels';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  fetchMyClips,
  fetchMyGoingShowMarks,
  fetchMyPoints,
  fetchSavedClips,
} from '@/src/lib/api/clips';
import type { ClipFeedItem, UserShowMark } from '@/src/lib/api/types';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

function isUpcomingMark(mark: UserShowMark): boolean {
  if (!mark.start_date?.trim()) return true;
  const start = Date.parse(mark.start_date);
  if (!Number.isFinite(start)) return true;
  return start > Date.now() - 4 * 60 * 60 * 1000;
}

export default function ProfileScreen() {
  const { user, isLoading: authLoading, refresh, signOut } = useAuth();
  const [clips, setClips] = useState<ClipFeedItem[]>([]);
  const [saved, setSaved] = useState<ClipFeedItem[]>([]);
  const [goingMarks, setGoingMarks] = useState<UserShowMark[]>([]);
  const [goingEnriched, setGoingEnriched] = useState<Record<string, unknown>[]>(
    [],
  );
  const [points, setPoints] = useState<{ points: number; level: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<{
    clip: ClipFeedItem;
    clips: ClipFeedItem[];
  } | null>(null);

  const load = useCallback(async () => {
    await refresh();
    const [myClips, savedClips, marks, pts] = await Promise.all([
      fetchMyClips({ page: 1, limit: 24 }),
      fetchSavedClips().catch(() => ({ clips: [] as ClipFeedItem[] })),
      fetchMyGoingShowMarks().catch(() => ({
        marks: [] as UserShowMark[],
        events: [] as Record<string, unknown>[],
      })),
      fetchMyPoints().catch(() => null),
    ]);
    setClips(myClips.clips);
    setSaved(savedClips.clips ?? []);
    setGoingMarks(marks.marks ?? []);
    setGoingEnriched(marks.events ?? []);
    setPoints(pts);
  }, [refresh]);

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
          setError(err instanceof Error ? err.message : 'Failed to load profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, load]);

  if (!authLoading && !user) {
    return <Redirect href="/auth" />;
  }

  const profile = user?.profile;
  const displayName =
    profile?.display_name?.trim() ||
    user?.google_user_data?.name?.trim() ||
    user?.email?.split('@')[0] ||
    'Your account';
  const avatar =
    profile?.profile_image_url?.trim() ||
    user?.google_user_data?.picture ||
    null;
  const location =
    profile?.city?.trim() ||
    profile?.location?.trim() ||
    null;

  if (loading && !profile && clips.length === 0) {
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
        <View style={styles.card}>
          <View style={styles.identity}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.identityText}>
              <Text style={styles.name}>{displayName}</Text>
              {user?.email ? (
                <Text style={styles.email}>{user.email}</Text>
              ) : null}
              {location ? <Text style={styles.meta}>{location}</Text> : null}
              {profile?.bio?.trim() ? (
                <Text style={styles.bio}>{profile.bio.trim()}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{points?.points ?? 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{points?.level ?? 1}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{clips.length}</Text>
              <Text style={styles.statLabel}>Clips</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.links}>
            <Link href="/saved" asChild>
              <Pressable style={styles.chip}>
                <Text style={styles.chipLabel}>Saved</Text>
              </Pressable>
            </Link>
            <Link href="/liked" asChild>
              <Pressable style={styles.chip}>
                <Text style={styles.chipLabel}>Liked</Text>
              </Pressable>
            </Link>
            <Pressable style={styles.chip} onPress={() => void signOut()}>
              <Text style={styles.chipLabel}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        <HorizontalClipCarousel
          title="Your clips"
          clips={clips}
          onPressClip={(clip) => setPlayer({ clip, clips })}
          emptyMessage="You have not posted clips yet."
        />

        <HorizontalClipCarousel
          title="Saved"
          clips={saved}
          onPressClip={(clip) => setPlayer({ clip, clips: saved })}
          emptyMessage="No saved clips yet."
        />

        <HorizontalMarkCarousel
          title="Shows you’re going to"
          marks={goingUpcoming}
          eventsByEventId={goingEventsById}
          emptyMessage="Mark a show as Going to see it here."
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.smoke,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  avatarLetter: {
    color: colors.textBody,
    fontSize: 28,
    fontWeight: '700',
  },
  identityText: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...typography.title,
  },
  email: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
  },
  bio: {
    ...typography.body,
    fontSize: 14,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.glassBg,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: colors.textBody,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  chipLabel: {
    color: colors.textBody,
    fontSize: 13,
    fontWeight: '600',
  },
});
