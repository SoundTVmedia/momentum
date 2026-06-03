import { computeShowId } from '../shared/show-id';
import { resolveClipEventTitle } from '../shared/event-title';

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
 * Backfill clips.show_id and event_title for rows missing them.
 * Processes several batches per scheduled run until the backlog is cleared.
 */
export async function backfillClipShowIds(env: Env): Promise<number> {
  let totalUpdated = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const updated = await backfillClipShowIdsBatch(env);
    totalUpdated += updated;
    if (updated === 0) break;
  }

  if (totalUpdated > 0) {
    console.log(`Backfilled show_id/event_title on ${totalUpdated} clip(s)`);
  }

  return totalUpdated;
}
