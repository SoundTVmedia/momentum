import { r2ClipFilePath } from '../shared/clip-poster-url';

/** Keys from `/api/upload` use `clips/{userId}/thumbnail/...` or `clips/{userId}/video/...`. */
export function r2ForClipObjectKey(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string
): R2Bucket {
  return key.includes('/thumbnail/') ? env.R2_THUMBNAILS_BUCKET : env.R2_BUCKET;
}

export async function getClipObjectFromR2(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string,
  opts?: { range?: { offset: number; length: number } }
): Promise<R2ObjectBody | null> {
  const primary = r2ForClipObjectKey(env, key);
  let object = await primary.get(key, opts);
  if (!object && key.includes('/thumbnail/')) {
    object = await env.R2_BUCKET.get(key, opts);
  }
  return object;
}

export async function clipObjectExistsInR2(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string,
): Promise<boolean> {
  const trimmed = key.trim();
  if (!trimmed) return false;
  const primary = r2ForClipObjectKey(env, trimmed);
  let head = await primary.head(trimmed);
  if (!head && trimmed.includes('/thumbnail/')) {
    head = await env.R2_BUCKET.head(trimmed);
  }
  return head != null;
}

function fileNameOfKey(key: string): string {
  const slash = key.lastIndexOf('/');
  return slash >= 0 ? key.slice(slash + 1) : key;
}

function pickLatestR2Key(keys: string[]): string {
  return [...keys].sort((a, b) => b.localeCompare(a))[0] ?? keys[0];
}

/**
 * When a stored video key 404s, pick a sibling object in the same folder.
 * Uploads sometimes rewrite the timestamp prefix while keeping `recording-clip_*`.
 */
export function pickRecoveredR2VideoKey(
  requestedKey: string,
  objectKeys: string[],
): string | null {
  const key = requestedKey.trim();
  if (!key.includes('/video/') || objectKeys.length === 0) return null;

  const slash = key.lastIndexOf('/');
  if (slash < 0) return null;
  const dir = key.slice(0, slash + 1);
  const name = key.slice(slash + 1);
  const siblings = objectKeys.filter((candidate) => candidate.startsWith(dir) && candidate !== key);
  if (siblings.length === 0) return null;

  const exactName = siblings.filter((candidate) => fileNameOfKey(candidate) === name);
  if (exactName.length === 1) return exactName[0];
  if (exactName.length > 1) return pickLatestR2Key(exactName);

  const recordingSuffix = name.match(/recording-clip_[^/]+$/i)?.[0];
  if (!recordingSuffix) return null;
  const suffixHits = siblings.filter((candidate) => candidate.endsWith(recordingSuffix));
  if (suffixHits.length === 1) return suffixHits[0];
  if (suffixHits.length > 1) return pickLatestR2Key(suffixHits);
  return null;
}

export async function recoverMissingR2VideoKey(
  env: { R2_BUCKET: R2Bucket },
  key: string,
): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed.includes('/video/')) return null;
  const slash = trimmed.lastIndexOf('/');
  if (slash < 0) return null;
  const listed = await env.R2_BUCKET.list({ prefix: trimmed.slice(0, slash + 1), limit: 500 });
  const objectKeys = (listed.objects ?? []).map((object) => object.key);
  return pickRecoveredR2VideoKey(trimmed, objectKeys);
}

/** Rewrite stored keys after a sibling recover, and un-hide clips that were only missing R2. */
export async function persistRecoveredR2VideoKey(
  env: { DB: D1Database },
  staleKey: string,
  recoveredKey: string,
): Promise<void> {
  const stale = staleKey.trim();
  const recovered = recoveredKey.trim();
  if (!stale || !recovered || stale === recovered) return;

  const videoUrl = r2ClipFilePath(recovered);
  await env.DB.prepare(
    `UPDATE clips
     SET r2_raw_key = ?,
         video_url = ?,
         playback_unplayable = CASE
           WHEN playback_unplayable_reason IS NULL
             OR playback_unplayable_reason IN ('r2_404', 'stream_and_r2_missing', 'no_valid_playback', 'bad_source_file', 'client_decode')
           THEN 0 ELSE playback_unplayable END,
         playback_unplayable_reason = CASE
           WHEN playback_unplayable_reason IS NULL
             OR playback_unplayable_reason IN ('r2_404', 'stream_and_r2_missing', 'no_valid_playback', 'bad_source_file', 'client_decode')
           THEN NULL ELSE playback_unplayable_reason END,
         playback_checked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE r2_raw_key = ? OR video_url = ?`,
  )
    .bind(recovered, videoUrl, stale, r2ClipFilePath(stale))
    .run();
}
