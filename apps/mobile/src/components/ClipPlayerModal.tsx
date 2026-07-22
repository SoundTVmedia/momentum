import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { resolveModalPlaybackSource } from '@/src/lib/api/clips';
import { ClipTicketSheet } from '@/src/components/ClipTicketSheet';
import { useClipArtistProfile } from '@/src/hooks/useClipArtistProfile';
import { useClipPlaybackTickets } from '@/src/hooks/useClipPlaybackTickets';
import { artistPath, venuePath } from '@shared/app-paths';
import { jamBaseEventTitle } from '@shared/event-title';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  clip: ClipFeedItem | null;
  /** Full feed for horizontal swipe navigation (Cap ClipModal parity). */
  clips?: ClipFeedItem[];
  visible: boolean;
  onClose: () => void;
  onChangeClip?: (clip: ClipFeedItem) => void;
};

type Session = {
  list: ClipFeedItem[];
  index: number;
};

function clipSource(clip: ClipFeedItem): string | null {
  const playback = resolveModalPlaybackSource(clip);
  return playback.src || playback.hlsFallbackSrc || null;
}

function ClipSlide({
  clip,
  width,
  isActive,
  modalVisible,
  onNavigateEntity,
}: {
  clip: ClipFeedItem;
  width: number;
  isActive: boolean;
  modalVisible: boolean;
  onNavigateEntity: (href: string) => void;
}) {
  const src = useMemo(() => clipSource(clip), [clip]);
  const player = useVideoPlayer(src, (instance) => {
    instance.loop = true;
  });

  useEffect(() => {
    if (!src) return;
    if (isActive && modalVisible) {
      try {
        player.play();
      } catch {
        /* player may be releasing */
      }
      return;
    }
    try {
      player.pause();
    } catch {
      /* ignore */
    }
  }, [isActive, modalVisible, src, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [player]);

  const title = clip.song_title?.trim() || clip.artist_name?.trim() || 'Clip';

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.slideMeta}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {clip.user_display_name ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {clip.user_display_name}
          </Text>
        ) : null}
        <View style={styles.entityRow}>
          {clip.artist_name ? (
            <Pressable
              onPress={() => onNavigateEntity(artistPath(clip.artist_name))}
            >
              <Text style={styles.metaLink} numberOfLines={1}>
                {clip.artist_name}
              </Text>
            </Pressable>
          ) : null}
          {clip.artist_name && clip.venue_name ? (
            <Text style={styles.meta}> · </Text>
          ) : null}
          {clip.venue_name ? (
            <Pressable
              onPress={() => onNavigateEntity(venuePath(clip.venue_name))}
            >
              <Text style={styles.metaLink} numberOfLines={1}>
                {clip.venue_name}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {src ? (
        <VideoView
          style={styles.video}
          player={player}
          contentFit="contain"
          nativeControls={isActive && modalVisible}
        />
      ) : (
        <View style={[styles.video, styles.videoEmpty]}>
          <Text style={styles.emptyText}>No playable source</Text>
        </View>
      )}
    </View>
  );
}

export function ClipPlayerModal({
  clip,
  clips,
  visible,
  onClose,
  onChangeClip,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;
  const listRef = useRef<FlatList<ClipFeedItem>>(null);
  const sessionRef = useRef<Session | null>(null);
  const onChangeClipRef = useRef(onChangeClip);
  onChangeClipRef.current = onChangeClip;
  const [session, setSession] = useState<Session | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ticketSheetOpen, setTicketSheetOpen] = useState(false);

  const activeClip = session?.list[activeIndex] ?? clip;
  const artistName = activeClip?.artist_name ?? null;
  const { websiteUrl, loading: merchLoading } = useClipArtistProfile(
    visible ? artistName : null,
  );
  const { show: ticketShow, loading: ticketLoading } = useClipPlaybackTickets(
    visible ? artistName : null,
  );

  const ticketEventTitle = useMemo(() => {
    if (!ticketShow?.event) return 'Nearest show';
    return (
      jamBaseEventTitle(ticketShow.event) ||
      (typeof ticketShow.event.name === 'string' ? ticketShow.event.name : null) ||
      'Nearest show'
    );
  }, [ticketShow]);

  useEffect(() => {
    if (!visible) setTicketSheetOpen(false);
  }, [visible]);

  useEffect(() => {
    setTicketSheetOpen(false);
  }, [activeClip?.id]);

  const navigateEntity = useCallback(
    (href: string) => {
      onClose();
      setTimeout(() => {
        router.push(href as `/artists/${string}` | `/venues/${string}`);
      }, 50);
    },
    [onClose, router],
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!visible || !clip) return;
    setSession((prev) => {
      if (prev?.list.length) {
        const existingIndex = prev.list.findIndex((item) => item.id === clip.id);
        if (existingIndex >= 0) {
          if (existingIndex === prev.index) return prev;
          return { list: prev.list, index: existingIndex };
        }
      }
      const list = clips && clips.length > 0 ? clips : [clip];
      const index = Math.max(
        0,
        list.findIndex((item) => item.id === clip.id),
      );
      return { list, index: index >= 0 ? index : 0 };
    });
  }, [visible, clip, clips]);

  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setSession(null), 350);
    return () => clearTimeout(timer);
  }, [visible]);

  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (!visible) {
      didInitialScroll.current = false;
      return;
    }
    if (!session || didInitialScroll.current) return;
    didInitialScroll.current = true;
    setActiveIndex(session.index);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: session.index,
        animated: false,
      });
    });
  }, [visible, session]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((item) => item.isViewable);
      if (first?.index == null) return;
      setActiveIndex(first.index);
      const next = sessionRef.current?.list[first.index];
      if (next) onChangeClipRef.current?.(next);
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const handleClose = useCallback(() => {
    setTicketSheetOpen(false);
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ClipFeedItem>) => (
      <ClipSlide
        clip={item}
        width={width}
        isActive={index === activeIndex}
        modalVisible={visible}
        onNavigateEntity={navigateEntity}
      />
    ),
    [width, activeIndex, visible, navigateEntity],
  );

  if (!session || session.list.length === 0) {
    return null;
  }

  const showMerch = Boolean(websiteUrl) && !merchLoading;
  const showTickets = Boolean(ticketShow?.ticketUrl) && !ticketLoading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerHint}>
            {session.list.length > 1
              ? `${activeIndex + 1} / ${session.list.length} · swipe`
              : 'Clip'}
          </Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <FlatList
          ref={listRef}
          data={session.list}
          keyExtractor={(item) => String(item.id)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={session.index}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={renderItem}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 50);
          }}
        />

        {showMerch || showTickets ? (
          <View style={styles.commerce}>
            {showMerch && websiteUrl ? (
              <Pressable
                style={styles.commerceBtn}
                onPress={() => void Linking.openURL(websiteUrl)}
              >
                <Text style={styles.commerceLabel}>Buy Merch</Text>
              </Pressable>
            ) : null}
            {showTickets && ticketShow?.ticketUrl ? (
              <Pressable
                style={styles.commerceBtn}
                onPress={() => setTicketSheetOpen(true)}
              >
                <Text style={styles.commerceLabel}>
                  Buy tickets to nearest show
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {ticketShow?.ticketUrl ? (
          <ClipTicketSheet
            visible={ticketSheetOpen}
            event={ticketShow.event}
            ticketUrl={ticketShow.ticketUrl}
            eventTitle={ticketEventTitle}
            onClose={() => setTicketSheetOpen(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  close: {
    color: colors.ember,
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
  },
  slideMeta: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  title: {
    ...typography.title,
    fontSize: 18,
  },
  subtitle: {
    ...typography.caption,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaLink: {
    ...typography.caption,
    color: colors.ember,
    fontWeight: '600',
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  commerce: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  commerceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  commerceLabel: {
    color: colors.textBody,
    fontWeight: '700',
    fontSize: 14,
  },
});
