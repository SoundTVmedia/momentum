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

function parseAspectRatio(ratio: string): number | null {
  const m = ratio.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (!m) return null;
  const w = Number.parseFloat(m[1]!);
  const h = Number.parseFloat(m[2]!);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  return w / h;
}

/** Modal layout: width-first for landscape / 16:9, height-first for portrait. */
export function clipModalPrefersFullWidth(clip: ClipAspectInput): boolean {
  if (clipIsLandscape(clip)) return true;
  const ratio = clipDisplayAspectRatio(clip);
  if (ratio) {
    const parsed = parseAspectRatio(ratio);
    if (parsed != null) return parsed >= 1;
  }
  return false;
}
