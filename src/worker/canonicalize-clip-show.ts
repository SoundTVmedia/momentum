import { isJamBaseEventId } from '../shared/show-id';
import {
  concertNameKey,
  pickCanonicalShowIdentity,
  type PastShowListRow,
} from './past-show-sql';

export type CanonicalShowTarget = {
  jambaseEventId: string | null;
  showId: string | null;
  artistName: string | null;
  venueName: string | null;
  eventTitle: string | null;
  timestamp: string | null;
  userId?: string | null;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function rowFromClip(row: Record<string, unknown>): PastShowListRow {
  return {
    show_id: text(row.show_id),
    event_title: text(row.event_title),
    artist_name: text(row.artist_name),
    show_date: text(row.timestamp),
    venue_name: text(row.venue_name),
    venue_location: null,
    jambase_event_id: text(row.jambase_event_id),
    jambase_venue_id: null,
    jambase_artist_id: null,
    clip_count: 1,
    thumbnail_url: null,
  };
}

function rowFromMark(row: Record<string, unknown>): PastShowListRow {
  const eventId = text(row.jambase_event_id);
  return {
    show_id: eventId,
    event_title: text(row.event_title),
    artist_name: text(row.artist_name),
    show_date: text(row.start_date),
    venue_name: text(row.venue_name),
    venue_location: null,
    jambase_event_id: eventId,
    jambase_venue_id: null,
    jambase_artist_id: null,
    clip_count: 0,
    thumbnail_url: null,
  };
}

/**
 * Point a new clip at the show that already exists for this concert.
 * A second JamBase listing for the same night must not become its own card.
 */
export async function canonicalizeClipShow(
  db: D1Database,
  target: CanonicalShowTarget,
): Promise<{ jambaseEventId: string | null; showId: string | null }> {
  const incoming: PastShowListRow = {
    show_id: target.showId,
    event_title: target.eventTitle,
    artist_name: target.artistName,
    show_date: target.timestamp,
    venue_name: target.venueName,
    venue_location: null,
    jambase_event_id: target.jambaseEventId,
    jambase_venue_id: null,
    jambase_artist_id: null,
    clip_count: 0,
    thumbnail_url: null,
  };

  const venueKey = concertNameKey(target.venueName);
  const titleKey = concertNameKey(target.eventTitle);
  const existing: PastShowListRow[] = [];

  if (venueKey.length >= 4 || titleKey.length >= 4 || target.jambaseEventId || target.showId) {
    const clips = await db
      .prepare(
        `SELECT jambase_event_id, show_id, event_title, artist_name, venue_name, timestamp
         FROM clips
         WHERE is_draft = 0
           AND (
             TRIM(IFNULL(jambase_event_id, '')) = ?
             OR TRIM(IFNULL(show_id, '')) = ?
             OR (? != '' AND instr(
               LOWER(REPLACE(REPLACE(IFNULL(venue_name, ''), '-', ' '), '''', '')),
               ?
             ) > 0)
             OR (? != '' AND instr(
               LOWER(REPLACE(REPLACE(IFNULL(event_title, ''), '-', ' '), '''', '')),
               ?
             ) > 0)
           )
         LIMIT 80`,
      )
      .bind(
        target.jambaseEventId ?? '',
        target.showId ?? '',
        venueKey,
        venueKey,
        titleKey,
        titleKey,
      )
      .all();
    for (const raw of clips.results ?? []) {
      existing.push(rowFromClip(raw as Record<string, unknown>));
    }
  }

  const userId = target.userId?.trim() || '';
  if (userId) {
    const marks = await db
      .prepare(
        `SELECT jambase_event_id, event_title, artist_name, venue_name, start_date
         FROM user_show_marks
         WHERE mocha_user_id = ?
         LIMIT 80`,
      )
      .bind(userId)
      .all();
    for (const raw of marks.results ?? []) {
      existing.push(rowFromMark(raw as Record<string, unknown>));
    }
  }

  const chosen = pickCanonicalShowIdentity(incoming, existing);
  if (!chosen) {
    return { jambaseEventId: target.jambaseEventId, showId: target.showId };
  }
  const jambaseEventId = isJamBaseEventId(chosen.jambase_event_id)
    ? chosen.jambase_event_id!.trim()
    : target.jambaseEventId;
  const showId =
    (isJamBaseEventId(chosen.show_id) ? chosen.show_id!.trim() : '') ||
    jambaseEventId ||
    chosen.show_id ||
    target.showId;
  return { jambaseEventId, showId };
}
