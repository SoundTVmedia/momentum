import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClipCarouselTile } from '@/src/components/ClipCarouselTile';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  clips: ClipFeedItem[];
  onPressClip: (clip: ClipFeedItem) => void;
  emptyMessage?: string;
  headerRight?: ReactNode;
};

export function HorizontalClipCarousel({
  title,
  subtitle,
  clips,
  onPressClip,
  emptyMessage,
  headerRight,
}: Props) {
  return (
    <View style={styles.section}>
      {title || subtitle || headerRight ? (
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      {clips.length === 0 ? (
        emptyMessage ? <Text style={styles.empty}>{emptyMessage}</Text> : null
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          decelerationRate="fast"
          snapToInterval={176}
          snapToAlignment="start"
        >
          {clips.map((clip) => (
            <ClipCarouselTile key={clip.id} clip={clip} onPress={onPressClip} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  headerRow: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.title,
    fontSize: 20,
  },
  subtitle: {
    ...typography.caption,
    lineHeight: 18,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingRight: spacing.lg,
  },
  empty: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
  },
});
