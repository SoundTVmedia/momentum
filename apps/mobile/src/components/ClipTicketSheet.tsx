import { Image } from 'expo-image';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatJamBaseEventDate,
  formatJamBaseEventTime,
  jamBaseEventCardImageUrl,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
  type JamBaseEventRecord,
} from '@shared/jambase-events';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type Props = {
  visible: boolean;
  event: JamBaseEventRecord;
  ticketUrl: string;
  eventTitle: string;
  onClose: () => void;
};

export function ClipTicketSheet({
  visible,
  event,
  ticketUrl,
  eventTitle,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const startDate = typeof event.startDate === 'string' ? event.startDate : null;
  const venueName = jamBaseEventVenueName(event);
  const venueCity = jamBaseEventVenueCityLine(event);
  const imageUrl = jamBaseEventCardImageUrl(event);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Nearest show</Text>
            <Text style={styles.title} numberOfLines={2}>
              {eventTitle}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
          <View style={styles.body}>
            <Text style={styles.rowTitle}>{formatJamBaseEventDate(startDate)}</Text>
            {startDate && formatJamBaseEventTime(startDate) ? (
              <Text style={styles.rowMeta}>{formatJamBaseEventTime(startDate)}</Text>
            ) : null}
            <Text style={[styles.rowTitle, { marginTop: spacing.sm }]}>{venueName}</Text>
            {venueCity ? <Text style={styles.rowMeta}>{venueCity}</Text> : null}
          </View>
        </View>

        <Text style={styles.note}>
          Ticket checkout opens in your browser — ticket sites don’t allow in-app
          checkout.
        </Text>

        <Pressable
          style={styles.cta}
          onPress={() => {
            void Linking.openURL(ticketUrl);
          }}
        >
          <Text style={styles.ctaLabel}>Buy tickets</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerText: { flex: 1, gap: 4 },
  eyebrow: { ...typography.label, fontSize: 10 },
  title: { ...typography.title, fontSize: 18 },
  close: { color: colors.ember, fontWeight: '600', fontSize: 16 },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBgStrong,
  },
  image: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.smoke },
  body: { padding: spacing.md, gap: 2 },
  rowTitle: { color: colors.textBody, fontWeight: '700', fontSize: 15 },
  rowMeta: { ...typography.caption },
  note: { ...typography.caption, lineHeight: 18 },
  cta: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.flare,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaLabel: { color: colors.textBody, fontWeight: '700', fontSize: 16 },
});
