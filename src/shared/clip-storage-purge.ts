import {
  r2KeyFromClipFileUrl,
  streamVideoIdFromClip,
  type ClipPlaybackFields,
} from './clip-poster-url';

export type ClipStoragePurgeFields = Pick<
  ClipPlaybackFields,
  | 'stream_video_id'
  | 'stream_playback_url'
  | 'video_url'
  | 'thumbnail_url'
  | 'stream_thumbnail_url'
  | 'r2_raw_key'
>;

function addKey(keys: Set<string>, value: string | null | undefined): void {
  const key = value?.trim();
  if (key) keys.add(key);
}

/** R2 object keys stored on the clip row (raw upload, playback file, posters). */
export function clipR2KeysForPurge(row: ClipStoragePurgeFields): string[] {
  const keys = new Set<string>();
  addKey(keys, row.r2_raw_key);
  addKey(keys, r2KeyFromClipFileUrl(row.video_url));
  addKey(keys, r2KeyFromClipFileUrl(row.thumbnail_url));
  addKey(keys, r2KeyFromClipFileUrl(row.stream_thumbnail_url));
  return [...keys];
}

/** Cloudflare Stream uid to DELETE when the clip is removed. */
export function clipStreamVideoIdForPurge(row: ClipStoragePurgeFields): string | null {
  return streamVideoIdFromClip(row);
}
