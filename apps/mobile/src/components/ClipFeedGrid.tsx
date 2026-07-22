import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { ClipGridTile } from '@/src/components/ClipGridTile';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  clips: ClipFeedItem[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  onRefresh: () => void;
  onEndReached: () => void;
  onPressClip: (clip: ClipFeedItem) => void;
  emptyMessage?: string;
  ListHeaderComponent?: ReactElement | null;
};

export function ClipFeedGrid({
  clips,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onEndReached,
  onPressClip,
  emptyMessage = 'No clips yet.',
  ListHeaderComponent,
}: Props) {
  if (loading && clips.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  return (
    <FlatList
      data={clips}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.ember}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <Text style={styles.empty}>{error ?? emptyMessage}</Text>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={styles.footer} color={colors.ember} />
        ) : null
      }
      renderItem={({ item }) => (
        <ClipGridTile clip={item} onPress={onPressClip} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  row: {
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.shellBg,
  },
  empty: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    marginVertical: spacing.lg,
  },
});
