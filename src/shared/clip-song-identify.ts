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
 * Whether this clip is missing a song and is eligible for identification.
 * Upload route does not matter: in-app camera, the upload tab, drag-and-drop,
 * and URL import all land here as a published row.
 *
 * The single exception is a "pre/post" clip, which is a friends-only talking
 * clip that deliberately carries no show or song association.
 *
 * The clip player only auto-runs identify when `shouldAutoIdentifyClip` is
 * true (the signed-in user posted the loaded clip).
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

/**
 * The clip player auto-runs Shazam → ACRCloud only when the signed-in user
 * posted the clip that is currently loaded. Superadmins can still tap Identify
 * on someone else's clip; looping playback must not start a lookup for others.
 */
export function shouldAutoIdentifyClip(
  clip: SongIdentifyClipFields,
  viewer: SongIdentifyViewer,
): boolean {
  if (!viewer.isOwner) return false;
  return clipNeedsSongIdentify(clip);
}
