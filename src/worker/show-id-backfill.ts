import { computeShowId } from '../shared/show-id';

const BACKFILL_BATCH_SIZE = 250;
const MAX_BATCHES_PER_RUN = 8;

type ClipShowRow = {
  id: number;
  jambase_event_id: string | null;
  artist_name: string | null;
  venue_name: string | null;
  timestamp: string | null;
};

async function backfillClipShowIdsBatch(env: Env): Promise<number> {
  const pending = await env.DB.prepare(
    `SELECT id, jambase_event_id, artist_name, venue_name, timestamp
     FROM clips
     WHERE show_id IS NULL
       AND (
         (jambase_event_id IS NOT NULL AND TRIM(jambase_event_id) != '')
         OR (
           artist_name IS NOT NULL AND TRIM(artist_name) != ''
           AND venue_name IS NOT NULL AND TRIM(venue_name) != ''
           AND timestamp IS NOT NULL AND TRIM(timestamp) != ''
         )
       )
     LIMIT ?`,
  )
    .bind(BACKFILL_BATCH_SIZE)
    .all();

  const rows = (pending.results || []) as ClipShowRow[];
  if (rows.length === 0) return 0;

  let updated = 0;
  for (const row of rows) {
    const showId = computeShowId({
      jambase_event_id: row.jambase_event_id,
      artist_name: row.artist_name,
      venue_name: row.venue_name,
      timestamp: row.timestamp,
    });
    if (!showId) continue;

    await env.DB.prepare(
      `UPDATE clips SET show_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(showId, row.id)
      .run();
    updated += 1;
  }

  return updated;
}

/**
 * Backfill clips.show_id for rows missing it (JamBase event id or artist+venue+date composite).
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
    console.log(`Backfilled show_id on ${totalUpdated} clip(s)`);
  }

  return totalUpdated;
}
