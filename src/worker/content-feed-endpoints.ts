import type { Context } from 'hono';
import { MAX_IDENTIFY_UPLOAD_BYTES } from '../shared/identify-music-limits';
import { clipsContentFeedColumnReady } from './content-feed-sql';
import { normalizeClipApiRows } from './clip-row-normalize';
import { mochaUserIdKey } from './mocha-user-id';
import {
  classifyClipContentFromAudio,
  inferClassifyFilename,
  loadValidClassification,
} from './content-feed-classify';
import { describeSpeechDetectionConfig } from './speech-detection';
import { describeMusicRecognitionConfig } from './music-recognition';

const MAX_SNIPPET_BYTES = MAX_IDENTIFY_UPLOAD_BYTES;

export async function getContentFeedConfig(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const music = describeMusicRecognitionConfig(c.env);
  const speech = describeSpeechDetectionConfig(c.env.AI);

  return c.json({
    endpoints: {
      classify: 'POST /api/clips/classify-content (multipart: file, headliner_name?)',
      friendsPrePost: 'GET /api/clips/friends-prepost',
    },
    acrcloud: music.acrcloud,
    whisper: speech,
    ready: music.acrcloud.ready && speech.ready,
    hint:
      !music.acrcloud.ready && music.hint
        ? music.hint
        : !speech.ready
          ? speech.hint
          : null,
  });
}

/**
 * POST multipart/form-data:
 * - `file` — short audio snippet (same limits as identify-music)
 * - `headliner_name` — show headliner for ACR ↔ headliner gate
 */
export async function postClassifyClipContent(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: FormData;
  try {
    body = await c.req.formData();
  } catch {
    return c.json({ error: 'Expected multipart form data' }, 400);
  }

  const raw = body.get('file');
  if (raw == null) {
    return c.json({ error: 'Missing file field' }, 400);
  }
  const blob = raw as Blob;
  if (typeof blob.arrayBuffer !== 'function' || blob.size === 0) {
    return c.json({ error: 'Missing file field' }, 400);
  }
  if (blob.size > MAX_SNIPPET_BYTES) {
    return c.json(
      { error: `File too large (max ${MAX_SNIPPET_BYTES} bytes for classification snippet)` },
      400,
    );
  }

  const headlinerRaw = body.get('headliner_name');
  const headlinerName =
    typeof headlinerRaw === 'string' && headlinerRaw.trim() ? headlinerRaw.trim() : null;

  const rawName =
    typeof (raw as { name?: unknown }).name === 'string' ? (raw as { name: string }).name : '';
  const filename = inferClassifyFilename(blob, rawName);

  const uid = mochaUserIdKey(mochaUser);
  const result = await classifyClipContentFromAudio(c.env, {
    mochaUserId: uid,
    audio: blob,
    filename,
    headlinerName,
  });

  return c.json({ ok: true, ...result });
}

/** Friends-only pre/post feed (clips from people you follow + your own). */
export async function getFriendsPrePostFeed(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '12', 10), 50);
  const offset = (page - 1) * limit;
  const uid = mochaUserIdKey(mochaUser);

  if (!(await clipsContentFeedColumnReady(c.env.DB))) {
    c.header('Cache-Control', 'private, no-store, must-revalidate');
    return c.json({
      clips: [],
      page,
      limit,
      hasMore: false,
      feed_scope: 'pre_post',
    });
  }

  const clips = await c.env.DB.prepare(
    `SELECT
      clips.rowid AS _clipRowId,
      clips.id AS clip_primary_id,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.is_hidden = 0
      AND clips.is_draft = 0
      AND clips.content_feed = 'pre_post'
      AND (
        clips.mocha_user_id = ?
        OR clips.mocha_user_id IN (
          SELECT following_id FROM follows WHERE follower_id = ?
        )
      )
    ORDER BY clips.created_at DESC
    LIMIT ? OFFSET ?`,
  )
    .bind(uid, uid, limit, offset)
    .all();

  c.header('Cache-Control', 'private, no-store, must-revalidate');

  return c.json({
    clips: normalizeClipApiRows((clips.results || []) as Record<string, unknown>[]),
    page,
    limit,
    hasMore: (clips.results || []).length === limit,
    feed_scope: 'pre_post',
  });
}

export { loadValidClassification };
