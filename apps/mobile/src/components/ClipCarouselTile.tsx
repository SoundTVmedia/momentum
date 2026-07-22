import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { resolveClipPosterUrl } from '@/src/lib/api/clips';
import { clipPostedAt, formatRelativeTime } from '@/src/lib/formatRelativeTime';
import { artistPath, venuePath } from '@shared/app-paths';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type Props = {
  clip: ClipFeedItem;
  onPress: (clip: ClipFeedItem) => void;
  width?: number;
};

export function ClipCarouselTile({ clip, onPress, width = 168 }: Props) {
  const router = useRouter();
  const poster = resolveClipPosterUrl(clip);
  const place = [clip.venue_name, clip.location].filter(Boolean).join(' · ');
  const relative = formatRelativeTime(clipPostedAt(clip));
  const trending =
    typeof clip.is_trending_score === 'number' && clip.is_trending_score >= 100;
  const featured = Boolean(clip.momentum_live_featured);

  return (
    <Pressable style={[styles.tile, { width }]} onPress={() => onPress(clip)}>
      <View style={styles.media}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
        {trending ? (
          <View style={styles.badgeTrending}>
            <Text style={styles.badgeText}>🔥</Text>
          </View>
        ) : null}
        {featured ? (
          <View style={styles.badgeFeatured}>
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        ) : null}
        <View style={styles.overlay}>
          <View style={styles.userRow}>
            {clip.user_avatar ? (
              <Image
                source={{ uri: clip.user_avatar }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}
            <Text style={styles.userName} numberOfLines={1}>
              {clip.user_display_name || 'Anonymous'}
            </Text>
            {relative ? (
              <Text style={styles.relative} numberOfLines={1}>
                · {relative}
              </Text>
            ) : null}
          </View>
          {clip.artist_name ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                router.push(artistPath(clip.artist_name) as `/artists/${string}`);
              }}
            >
              <Text style={styles.artist} numberOfLines={1}>
                {clip.artist_name}
              </Text>
            </Pressable>
          ) : null}
          {clip.venue_name ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                router.push(venuePath(clip.venue_name) as `/venues/${string}`);
              }}
            >
              <Text style={styles.place} numberOfLines={1}>
                {place || clip.venue_name}
              </Text>
            </Pressable>
          ) : place ? (
            <Text style={styles.place} numberOfLines={1}>
              {place}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginRight: spacing.sm,
  },
  media: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.smoke,
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: colors.shellBgDeep,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(3, 7, 18, 0.72)',
    gap: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarFallback: {
    backgroundColor: colors.glassBgStrong,
  },
  userName: {
    ...typography.caption,
    color: colors.textBody,
    fontWeight: '600',
    flexShrink: 1,
  },
  relative: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
  },
  artist: {
    color: colors.textBody,
    fontSize: 13,
    fontWeight: '700',
  },
  place: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badgeTrending: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.flare,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
  },
  badgeFeatured: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.flare,
  },
  featuredText: {
    color: colors.textBody,
    fontSize: 10,
    fontWeight: '700',
  },
});
