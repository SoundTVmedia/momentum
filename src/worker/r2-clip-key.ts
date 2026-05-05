/** Keys from `/api/upload` use `clips/{userId}/thumbnail/...` or `clips/{userId}/video/...`. */
export function r2ForClipObjectKey(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string
): R2Bucket {
  return key.includes('/thumbnail/') ? env.R2_THUMBNAILS_BUCKET : env.R2_BUCKET;
}

export async function getClipObjectFromR2(
  env: { R2_BUCKET: R2Bucket; R2_THUMBNAILS_BUCKET: R2Bucket },
  key: string
): Promise<R2ObjectBody | null> {
  const primary = r2ForClipObjectKey(env, key);
  let object = await primary.get(key);
  if (!object && key.includes('/thumbnail/')) {
    object = await env.R2_BUCKET.get(key);
  }
  return object;
}
