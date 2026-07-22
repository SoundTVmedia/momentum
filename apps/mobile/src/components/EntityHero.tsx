import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

const ARTIST_FALLBACK =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
const VENUE_FALLBACK =
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&h=300&fit=crop';

type Props = {
  variant: 'artist' | 'venue';
  name: string;
  imageUrl?: string | null;
  subtitle?: string | null;
  bio?: string | null;
  verified?: boolean;
  capacity?: number | null;
  following?: boolean;
  followLoading?: boolean;
  onToggleFollow?: () => void;
  showFollow?: boolean;
};

export function EntityHero({
  variant,
  name,
  imageUrl,
  subtitle,
  bio,
  verified,
  capacity,
  following,
  followLoading,
  onToggleFollow,
  showFollow,
}: Props) {
  const fallback = variant === 'artist' ? ARTIST_FALLBACK : VENUE_FALLBACK;

  return (
    <View style={styles.hero}>
      <Image
        source={{ uri: imageUrl?.trim() || fallback }}
        style={[styles.image, variant === 'artist' ? styles.imageRound : styles.imageSquare]}
        contentFit="cover"
      />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {verified ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Verified</Text>
          </View>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {capacity != null && Number.isFinite(capacity) ? (
          <Text style={styles.meta}>Capacity: {capacity.toLocaleString()}</Text>
        ) : null}
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
        {showFollow && onToggleFollow ? (
          <Pressable
            style={[styles.followBtn, following && styles.followBtnActive]}
            onPress={onToggleFollow}
            disabled={followLoading}
          >
            <Text style={styles.followLabel}>
              {followLoading
                ? 'Updating…'
                : following
                  ? variant === 'artist'
                    ? 'Unfollow Artist'
                    : 'Unfollow Venue'
                  : variant === 'artist'
                    ? 'Follow Artist'
                    : 'Follow Venue'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function parseSocialLinks(raw: string | null | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return v as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function SocialLinksRow({ links }: { links: Record<string, string> }) {
  const entries = Object.entries(links).filter(([, url]) => typeof url === 'string' && url.trim());
  if (entries.length === 0) return null;
  return (
    <View style={styles.socialRow}>
      {entries.map(([key, url]) => (
        <Pressable
          key={key}
          style={styles.socialChip}
          onPress={() => void Linking.openURL(url)}
        >
          <Text style={styles.socialLabel}>{key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  image: {
    width: 140,
    height: 140,
    backgroundColor: colors.smoke,
  },
  imageRound: {
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(99, 102, 241, 0.45)',
  },
  imageSquare: {
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  info: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.title,
    fontSize: 28,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  badgeText: {
    color: colors.ember,
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  meta: {
    ...typography.caption,
  },
  bio: {
    ...typography.body,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  followBtn: {
    marginTop: spacing.sm,
    minWidth: 180,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.flare,
    alignItems: 'center',
  },
  followBtnActive: {
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  followLabel: {
    color: colors.textBody,
    fontWeight: '700',
    fontSize: 15,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  socialChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  socialLabel: {
    color: colors.textBody,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
