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
