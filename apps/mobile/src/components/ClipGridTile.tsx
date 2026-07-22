import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { resolveClipPosterUrl } from '@/src/lib/api/clips';
import { artistPath, venuePath } from '@shared/app-paths';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type Props = {
  clip: ClipFeedItem;
  onPress: (clip: ClipFeedItem) => void;
};

export function ClipGridTile({ clip, onPress }: Props) {
  const router = useRouter();
  const poster = resolveClipPosterUrl(clip);
  const title = clip.song_title?.trim() || clip.artist_name?.trim() || 'Untitled clip';

  return (
    <Pressable style={styles.tile} onPress={() => onPress(clip)}>
      <View style={styles.media}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {clip.artist_name ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            router.push(artistPath(clip.artist_name) as `/artists/${string}`);
          }}
        >
          <Text style={styles.subtitle} numberOfLines={1}>
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
          <Text style={styles.meta} numberOfLines={1}>
            {clip.venue_name}
          </Text>
        </Pressable>
      ) : clip.user_display_name ? (
        <Text style={styles.meta} numberOfLines={1}>
          {clip.user_display_name}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    margin: spacing.xs,
    maxWidth: '50%',
  },
  media: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.smoke,
    aspectRatio: 9 / 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: colors.shellBgDeep,
  },
  title: {
    ...typography.body,
    color: colors.textBody,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textBody,
    fontWeight: '600',
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
