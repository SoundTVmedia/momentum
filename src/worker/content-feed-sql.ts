import { MAIN_FEED_CLIP_SQL } from '../shared/content-feed';

/** True when migration 57+ applied (`clips.content_feed` exists). */
export async function clipsContentFeedColumnReady(db: D1Database): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT 1 AS ok FROM pragma_table_info('clips') WHERE name = 'content_feed' LIMIT 1`)
      .first();
    return row != null;
  } catch {
    return false;
  }
}

/** SQL fragment for public main-feed clips, or `1=1` when column not migrated yet. */
export async function mainFeedClipFilterSql(db: D1Database): Promise<string> {
  const ready = await clipsContentFeedColumnReady(db);
  return ready ? MAIN_FEED_CLIP_SQL : '1=1';
}
