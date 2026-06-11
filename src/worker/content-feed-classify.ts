import { classifyContentFeed, type ContentFeedClassification } from '../shared/content-feed';
import { recognizeMusic, inferIdentifyFilename } from './music-recognition';

export type ClassifyClipContentResult = ContentFeedClassification & {
  classification_id?: string;
};

function newClassificationId(): string {
  return crypto.randomUUID();
}

export async function classifyClipContentFromAudio(
  env: Env,
  opts: {
    mochaUserId: string;
    audio: Blob;
    filename: string;
    headlinerName: string | null;
    persist?: boolean;
  },
): Promise<ClassifyClipContentResult> {
  const acrOut = await recognizeMusic(env, opts.audio, opts.filename);

  let acrMatch: { artist: string; title: string } | null = null;
  if (acrOut.ok && acrOut.match) {
    const artist = acrOut.match.artist?.trim() ?? '';
    const title = acrOut.match.title?.trim() ?? '';
    if (artist || title) {
      acrMatch = { artist, title };
    }
  }

  const classified = classifyContentFeed({
    acrMatch,
    headlinerName: opts.headlinerName,
  });

  const classificationId = newClassificationId();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (opts.persist !== false) {
    try {
      await env.DB.prepare(
        `INSERT INTO clip_content_classifications
         (id, mocha_user_id, content_feed, acr_matched, has_speech, headliner_matched,
          reason, acr_artist, acr_title, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          classificationId,
          opts.mochaUserId,
          classified.content_feed,
          classified.acr_matched ? 1 : 0,
          classified.has_speech ? 1 : 0,
          classified.headliner_matched ? 1 : 0,
          classified.reason,
          classified.acr_artist ?? null,
          classified.acr_title ?? null,
          expiresAt,
        )
        .run();
    } catch (e) {
      console.error('[content-feed] failed to persist classification', e);
    }
  }

  return {
    ...classified,
    classification_id: classificationId,
  };
}

export async function loadValidClassification(
  db: D1Database,
  classificationId: string,
  mochaUserId: string,
): Promise<{
  content_feed: string;
  acr_matched: number;
  has_speech: number;
  headliner_matched: number;
  acr_artist: string | null;
  acr_title: string | null;
} | null> {
  const row = await db
    .prepare(
      `SELECT content_feed, acr_matched, has_speech, headliner_matched, acr_artist, acr_title
       FROM clip_content_classifications
       WHERE id = ? AND mocha_user_id = ? AND expires_at > CURRENT_TIMESTAMP`,
    )
    .bind(classificationId, mochaUserId)
    .first();

  if (!row) return null;
  return row as {
    content_feed: string;
    acr_matched: number;
    has_speech: number;
    headliner_matched: number;
    acr_artist: string | null;
    acr_title: string | null;
  };
}

export function inferClassifyFilename(blob: Blob, rawName?: string): string {
  return inferIdentifyFilename(blob, rawName);
}
