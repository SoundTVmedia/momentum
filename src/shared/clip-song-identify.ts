import { isPrePostContentFeed } from './pre-post-clip';

export type SongIdentifyClipFields = {
  song_title?: string | null;
  content_feed?: string | null;
};

export type SongIdentifyViewer = {
  isOwner: boolean;
  isSuperadmin: boolean;
};

/**
 * Tap-to-identify is offered on any clip with no song attached, whatever route
 * it took to get here: in-app camera, the upload tab, drag-and-drop, or a URL
 * import. Identification reads the published file from the server, so the
 * upload method makes no difference to whether it can run.
 *
 * The single exception is a "pre/post" clip, which is a friends-only talking
 * clip that deliberately carries no show or song association.
 */
export function clipNeedsSongIdentify(clip: SongIdentifyClipFields): boolean {
  if (isPrePostContentFeed(clip.content_feed)) return false;
  return !clip.song_title?.trim();
}

/** Saving the result writes to the clip, so only an owner or superadmin may run it. */
export function canRunClipSongIdentify(
  clip: SongIdentifyClipFields,
  viewer: SongIdentifyViewer,
): boolean {
  if (!viewer.isOwner && !viewer.isSuperadmin) return false;
  return clipNeedsSongIdentify(clip);
}
