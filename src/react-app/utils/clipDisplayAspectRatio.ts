export type ClipAspectInput = {
  recording_orientation?: string | null;
  video_resolution_w?: number | null;
  video_resolution_h?: number | null;
};

/**
 * CSS aspect-ratio value (e.g. "9 / 16") from stored clip metadata, or undefined if unknown.
 */
export function clipIsLandscape(clip: ClipAspectInput): boolean {
  const w = clip.video_resolution_w;
  const h = clip.video_resolution_h;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return w >= h;
  }
  if (clip.recording_orientation === 'landscape') return true;
  if (clip.recording_orientation === 'portrait') return false;
  return false;
}

export function clipDisplayAspectRatio(clip: ClipAspectInput): string | undefined {
  const w = clip.video_resolution_w;
  const h = clip.video_resolution_h;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return `${w} / ${h}`;
  }
  if (clip.recording_orientation === 'portrait') return '9 / 16';
  if (clip.recording_orientation === 'landscape') return '16 / 9';
  return undefined;
}

/** Modal layout default when resolution/orientation is unknown. */
export function clipModalFallbackAspectRatio(clip: ClipAspectInput): string {
  return clipIsLandscape(clip) ? '16 / 9' : '9 / 16';
}
