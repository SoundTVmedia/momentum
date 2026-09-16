import { computeShowId, isJamBaseEventId, majorityCaptureDay, utcYmdFromTimestamp } from '../shared/show-id';
import { resolveClipEventTitle } from '../shared/event-title';
import { clipNightKeySql } from './past-show-sql';

const BACKFILL_BATCH_SIZE = 250;
const MAX_BATCHES_PER_RUN = 8;

type ClipShowRow = {
  id: number;
  show_id: string | null;
  jambase_event_id: string | null;
  artist_name: string | null;
  venue_name: string | null;
  timestamp: string | null;
  event_title: string | null;
};

type SiblingJamBaseRow = {
  id: number;
  show_id: string | null;
  jambase_event_id: string | null;
  sibling_event_id: string;
  sibling_artist_id: string | null;
  sibling_venue_id: string | null;
};

async function backfillClipShowIdsBatch(env: Env): Promise<number> {
  const pending = await env.DB.prepare(
    `SELECT id, show_id, jambase_event_id, artist_name, venue_name, timestamp, event_title
     FROM clips
     WHERE (
         show_id IS NULL
         AND (
           (jambase_event_id IS NOT NULL AND TRIM(jambase_event_id) != '')
           OR (
             artist_name IS NOT NULL AND TRIM(artist_name) != ''
             AND venue_name IS NOT NULL AND TRIM(venue_name) != ''
             AND timestamp IS NOT NULL AND TRIM(timestamp) != ''
           )
         )
       )
       OR (
         event_title IS NULL
         AND artist_name IS NOT NULL AND TRIM(artist_name) != ''
         AND venue_name IS NOT NULL AND TRIM(venue_name) != ''
       )
     LIMIT ?`,
  )
    .bind(BACKFILL_BATCH_SIZE)
    .all();

  const rows = (pending.results || []) as ClipShowRow[];
  if (rows.length === 0) return 0;

  let updated = 0;
  for (const row of rows) {
    const nextShowId =
      row.show_id?.trim() ||
      computeShowId({
        jambase_event_id: row.jambase_event_id,
        artist_name: row.artist_name,
        venue_name: row.venue_name,
        timestamp: row.timestamp,
      });
    const nextEventTitle =
      row.event_title?.trim() ||
      resolveClipEventTitle({
        artist_name: row.artist_name,
        venue_name: row.venue_name,
      });

    if (!nextShowId && !nextEventTitle) continue;
    if (nextShowId === row.show_id?.trim() && nextEventTitle === row.event_title?.trim()) continue;

    await env.DB.prepare(
      `UPDATE clips
       SET show_id = COALESCE(?, show_id),
           event_title = COALESCE(?, event_title),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(nextShowId, nextEventTitle, row.id)
      .run();
    updated += 1;
  }

  return updated;
}

/**
 * Detach clips whose capture day does not match the majority night for their
 * stored JamBase event id (e.g. a Dec Phish MSG clip tagged with a July event).
 * Clears the wrong JamBase id and assigns a date-based composite show_id.
 */
async function detachOutlierJamBaseShowIdsBatch(env: Env): Promise<number> {
  const captureDaySql = `strftime(
    '%Y-%m-%d',
    datetime(replace(replace(substr(TRIM(timestamp), 1, 19), 'T', ' '), 'Z', ''))
  )`;
  const mixed = await env.DB.prepare(
    `SELECT TRIM(jambase_event_id) as event_id
     FROM clips
     WHERE NULLIF(TRIM(jambase_event_id), '') IS NOT NULL
       AND NULLIF(TRIM(timestamp), '') IS NOT NULL
     GROUP BY TRIM(jambase_event_id)
     HAVING COUNT(DISTINCT ${captureDaySql}) > 1
     LIMIT 50`,
  ).all();

  const eventIds = ((mixed.results || []) as Array<{ event_id: string }>)
    .map((row) => row.event_id?.trim())
    .filter((id): id is string => Boolean(id));
  if (eventIds.length === 0) return 0;

  let updated = 0;
  for (const eventId of eventIds) {
    const pending = await env.DB.prepare(
      `SELECT id, show_id, jambase_event_id, artist_name, venue_name, timestamp, event_title
       FROM clips
       WHERE TRIM(jambase_event_id) = ?`,
    )
      .bind(eventId)
      .all();
    const rows = (pending.results || []) as ClipShowRow[];
    const majorityDay = majorityCaptureDay(rows.map((row) => row.timestamp));
    if (!majorityDay) continue;

    for (const row of rows) {
      const day =
        typeof row.timestamp === 'string' ? utcYmdFromTimestamp(row.timestamp) : null;
      if (!day || day === majorityDay) continue;

      const nextShowId = computeShowId({
        artist_name: row.artist_name,
        venue_name: row.venue_name,
        timestamp: row.timestamp,
      });
      if (!nextShowId) continue;

      await env.DB.prepare(
        `UPDATE clips
         SET jambase_event_id = NULL,
             show_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
        .bind(nextShowId, row.id)
        .run();
      updated += 1;
      if (updated >= BACKFILL_BATCH_SIZE) return updated;
    }
  }

  return updated;
}

/**
 * Promote composite/slug show ids to a sibling JamBase event id from the same
 * concert night (e.g. earliest Ariana clip stored as a slug while later clips
 * stored jambase:14852021).
 */
async function promoteSiblingJamBaseShowIdsBatch(env: Env): Promise<number> {
  const night = clipNightKeySql('clips');
  const siblingNight = clipNightKeySql('sibling');
  const pending = await env.DB.prepare(
    `SELECT
       clips.id as id,
       clips.show_id as show_id,
       clips.jambase_event_id as jambase_event_id,
       TRIM(sibling.jambase_event_id) as sibling_event_id,
       NULLIF(TRIM(sibling.jambase_artist_id), '') as sibling_artist_id,
       NULLIF(TRIM(sibling.jambase_venue_id), '') as sibling_venue_id
     FROM clips
     INNER JOIN clips AS sibling
       ON sibling.id != clips.id
      AND NULLIF(TRIM(sibling.jambase_event_id), '') IS NOT NULL
      AND ${siblingNight} IS NOT NULL
      AND ${night} IS NOT NULL
      AND ${siblingNight} = ${night}
     WHERE (
       NULLIF(TRIM(clips.jambase_event_id), '') IS NULL
       OR (
         NULLIF(TRIM(clips.show_id), '') IS NOT NULL
         AND TRIM(clips.show_id) NOT LIKE 'jambase:%'
       )
     )
     LIMIT ?`,
  )
    .bind(BACKFILL_BATCH_SIZE)
    .all();

  const rows = (pending.results || []) as SiblingJamBaseRow[];
  if (rows.length === 0) return 0;

  const seen = new Set<number>();
  let updated = 0;
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);

    const siblingEventId = row.sibling_event_id?.trim() || '';
    if (!isJamBaseEventId(siblingEventId)) continue;

    const currentShowId = row.show_id?.trim() || '';
    const currentEventId = row.jambase_event_id?.trim() || '';
    if (currentEventId === siblingEventId && currentShowId === siblingEventId) continue;

    await env.DB.prepare(
      `UPDATE clips
       SET jambase_event_id = ?,
           show_id = ?,
           jambase_artist_id = COALESCE(NULLIF(TRIM(jambase_artist_id), ''), ?),
           jambase_venue_id = COALESCE(NULLIF(TRIM(jambase_venue_id), ''), ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(
        siblingEventId,
        siblingEventId,
        row.sibling_artist_id,
        row.sibling_venue_id,
        row.id,
      )
      .run();
    updated += 1;
  }

  return updated;
}

/**
 * Backfill clips.show_id / event_title, detach cross-night JamBase outliers,
 * then promote same-night composite ids to a sibling JamBase event id.
 */
export async function backfillClipShowIds(env: Env): Promise<number> {
  let totalUpdated = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const updated = await backfillClipShowIdsBatch(env);
    totalUpdated += updated;
    if (updated === 0) break;
  }

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const updated = await detachOutlierJamBaseShowIdsBatch(env);
    totalUpdated += updated;
    if (updated === 0) break;
  }

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const updated = await promoteSiblingJamBaseShowIdsBatch(env);
    totalUpdated += updated;
    if (updated === 0) break;
  }

  if (totalUpdated > 0) {
    console.log(`Backfilled show_id/event_title on ${totalUpdated} clip(s)`);
  }

  return totalUpdated;
}

/** Exported for unit tests. */
export const __testing = {
  promoteSiblingJamBaseShowIdsBatch,
  detachOutlierJamBaseShowIdsBatch,
};
