import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ShowEvent, UserShowMark } from '@/src/lib/api/types';
import { formatShowDate } from '@/src/lib/formatRelativeTime';
import {
  jamBaseEventCardImageUrl,
  jamBaseEventVenueCityLine,
  jamBaseEventVenueName,
} from '@shared/jambase-events';
import { jamBaseEventTitle } from '@shared/event-title';
import {
  mergeJamBaseEventWithShowMark,
  type UserShowMark as SharedShowMark,
} from '@shared/show-marks';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function eventTitle(event: ShowEvent | UserShowMark | Record<string, unknown>): string {
  const asMark = event as UserShowMark;
  const markTitle = asText(asMark.event_title);
  if (markTitle) return markTitle;

  const asShow = event as ShowEvent;
  const shared = jamBaseEventTitle(asShow as Record<string, unknown>);
  if (shared) return shared;

  const title = asText(asShow.title) || asText(asShow.name);
  if (title) return title;

  const artist = asText(asShow.artist_name);
  const venue = eventVenueLine(asShow);
  return [artist, venue].filter(Boolean).join(' @ ') || 'Show';
}

function eventVenueLine(event: ShowEvent | UserShowMark | Record<string, unknown>): string {
  const asMark = event as UserShowMark;
  const markVenue = asText(asMark.venue_name);
  if (markVenue) return markVenue;

  const asShow = event as ShowEvent;
  const flatVenue = asText(asShow.venue_name);
  if (flatVenue) return flatVenue;

  if (asShow.location && typeof asShow.location === 'object') {
    const venue = jamBaseEventVenueName(asShow as Record<string, unknown>);
    const city = jamBaseEventVenueCityLine(asShow as Record<string, unknown>);
    return [venue !== 'Venue TBA' ? venue : '', city].filter(Boolean).join(' · ');
  }

  return asText(asShow.location);
}

/** Always returns a usable image URL (JamBase art or stock fallback). */
function eventImageUrl(
  event: ShowEvent | UserShowMark | Record<string, unknown>,
): string {
  const asShow = event as ShowEvent;
  const direct =
    asText(asShow.image) ||
    asText(asShow.image_url) ||
    asText(asShow.poster_url);
  if (direct) return direct;
  return jamBaseEventCardImageUrl(event as Record<string, unknown>);
}

function eventWhen(event: ShowEvent | UserShowMark | Record<string, unknown>): string {
  const asShow = event as ShowEvent;
  const iso =
    asText((event as UserShowMark).start_date) ||
    asText(asShow.start_date) ||
    asText(asShow.startDate);
  return formatShowDate(iso || null);
}

function asSharedMark(mark: UserShowMark): SharedShowMark {
  return {
    id: typeof mark.id === 'number' ? mark.id : 0,
    status: mark.status === 'attended' ? 'attended' : 'going',
    jambase_event_id: mark.jambase_event_id,
    jambase_venue_id:
      typeof mark.jambase_venue_id === 'string' ? mark.jambase_venue_id : null,
    jambase_artist_id:
      typeof mark.jambase_artist_id === 'string' ? mark.jambase_artist_id : null,
    event_title: mark.event_title ?? null,
    artist_name: mark.artist_name ?? null,
    venue_name: mark.venue_name ?? null,
    venue_location:
      typeof mark.venue_location === 'string' ? mark.venue_location : null,
    venue_timezone:
      typeof mark.venue_timezone === 'string' ? mark.venue_timezone : null,
    start_date: mark.start_date ?? null,
    created_at: typeof mark.created_at === 'string' ? mark.created_at : '',
    updated_at: typeof mark.updated_at === 'string' ? mark.updated_at : '',
  };
}

type CardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  imageUrl?: string | null;
};

function ShowCard({ title, subtitle, meta, badge, imageUrl }: CardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.media}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type ShowsProps = {
  title: string;
  subtitle?: string;
  events: ShowEvent[];
  emptyMessage?: string;
  badge?: string;
  onPressEvent?: (event: ShowEvent) => void;
};

export function HorizontalShowCarousel({
  title,
  subtitle,
  events,
  emptyMessage,
  badge,
  onPressEvent,
}: ShowsProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {events.length === 0 ? (
        emptyMessage ? <Text style={styles.empty}>{emptyMessage}</Text> : null
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {events.map((event, index) => {
            const cardTitle = eventTitle(event);
            return (
              <Pressable
                key={String(event.id ?? event.identifier ?? `${cardTitle}-${index}`)}
                onPress={onPressEvent ? () => onPressEvent(event) : undefined}
                disabled={!onPressEvent}
              >
                <ShowCard
                  title={cardTitle}
                  subtitle={eventVenueLine(event) || undefined}
                  meta={eventWhen(event)}
                  badge={badge}
                  imageUrl={eventImageUrl(event)}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

type MarksProps = {
  title: string;
  subtitle?: string;
  marks: UserShowMark[];
  /** Parallel enriched JamBase events from show-marks?enrich=jambase */
  enrichedEvents?: Record<string, unknown>[];
  /** Map of jambase_event_id → JamBase event (friends-going) */
  eventsByEventId?: Record<string, Record<string, unknown>>;
  emptyMessage?: string;
  badge?: string;
  /** Optional per-mark subtitle override (e.g. friend display name) */
  subtitleForMark?: (mark: UserShowMark) => string | undefined;
  onPressMark?: (mark: UserShowMark) => void;
};

export function HorizontalMarkCarousel({
  title,
  subtitle,
  marks,
  enrichedEvents,
  eventsByEventId,
  emptyMessage,
  badge = 'Going',
  subtitleForMark,
  onPressMark,
}: MarksProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {marks.length === 0 ? (
        emptyMessage ? <Text style={styles.empty}>{emptyMessage}</Text> : null
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {marks.map((mark, index) => {
            const jb =
              eventsByEventId?.[mark.jambase_event_id] ??
              enrichedEvents?.[index] ??
              null;
            const merged = mergeJamBaseEventWithShowMark(asSharedMark(mark), jb);
            const place =
              subtitleForMark?.(mark) ||
              eventVenueLine(merged) ||
              eventVenueLine(mark) ||
              undefined;
            return (
              <Pressable
                key={mark.jambase_event_id}
                onPress={onPressMark ? () => onPressMark(mark) : undefined}
                disabled={!onPressMark}
              >
                <ShowCard
                  title={eventTitle(merged) || eventTitle(mark)}
                  subtitle={place}
                  meta={eventWhen(merged) || eventWhen(mark)}
                  badge={badge}
                  imageUrl={eventImageUrl(merged)}
                />
              </Pressable>
            );
          })}
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
  header: {
    paddingHorizontal: spacing.md,
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
  card: {
    width: 220,
    marginRight: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: colors.smoke,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: colors.shellBgDeep,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.85)',
  },
  badgeText: {
    color: colors.textBody,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardBody: {
    padding: spacing.md,
    gap: 4,
    minHeight: 88,
  },
  cardTitle: {
    color: colors.textBody,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
});
