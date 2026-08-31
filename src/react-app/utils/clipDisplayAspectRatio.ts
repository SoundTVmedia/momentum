export type ClipAspectInput = {
  recording_orientation?: string | null;
  video_resolution_w?: number | null;
  video_resolution_h?: number | null;
};

export type ClipPlayerLayout = {
  /** Landscape: span the player's width. Portrait: span the player's height. */
  fillWidth: boolean;
  aspectRatio: string;
  width: number;
  height: number;
};

/** Pixel size of the video frame inside the player. Overflow is cropped. */
export function clipPlayerFramePixels(
  player: { width: number; height: number },
  layout: ClipPlayerLayout,
): { width: number; height: number } {
  const ar = layout.width / layout.height;
  if (layout.fillWidth) {
    return { width: player.width, height: player.width / ar };
  }
  return { height: player.height, width: player.height * ar };
}

function validPixels(
  w: number | null | undefined,
  h: number | null | undefined,
): { w: number; h: number } | null {
  if (typeof w !== 'number' || typeof h !== 'number' || w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * Size the modal frame to the clip's natural ratio: 16:9 (and other landscape)
 * fills the player width; 9:16 fills the player height. Crop inside that frame.
 */
export function clipPlayerLayout(
  clip: ClipAspectInput,
  measured?: { width: number; height: number } | null,
): ClipPlayerLayout {
  let pixels =
    validPixels(measured?.width, measured?.height) ??
    validPixels(clip.video_resolution_w, clip.video_resolution_h);

  const ori = clip.recording_orientation;
  // iOS often stores coded landscape size for a portrait recording.
  if (pixels && ori === 'portrait' && pixels.w > pixels.h) {
    pixels = { w: pixels.h, h: pixels.w };
  }

  if (pixels) {
    return {
      fillWidth: pixels.w >= pixels.h,
      aspectRatio: `${pixels.w} / ${pixels.h}`,
      width: pixels.w,
      height: pixels.h,
    };
  }
  if (ori === 'landscape') {
    return { fillWidth: true, aspectRatio: '16 / 9', width: 16, height: 9 };
  }
  return { fillWidth: false, aspectRatio: '9 / 16', width: 9, height: 16 };
}

/**
 * CSS aspect-ratio value (e.g. "9 / 16") from stored clip metadata, or undefined if unknown.
 */
export function clipIsLandscape(clip: ClipAspectInput): boolean {
  return clipPlayerLayout(clip).fillWidth;
}

export function clipDisplayAspectRatio(clip: ClipAspectInput): string | undefined {
  const w = clip.video_resolution_w;
  const h = clip.video_resolution_h;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return clipPlayerLayout(clip).aspectRatio;
  }
  if (clip.recording_orientation === 'portrait') return '9 / 16';
  if (clip.recording_orientation === 'landscape') return '16 / 9';
  return undefined;
}

/** Modal layout default when resolution/orientation is unknown. */
export function clipModalFallbackAspectRatio(clip: ClipAspectInput): string {
  return clipPlayerLayout(clip).aspectRatio;
}

/** Modal layout: width-first for landscape / 16:9, height-first for portrait. */
export function clipModalPrefersFullWidth(clip: ClipAspectInput): boolean {
  return clipPlayerLayout(clip).fillWidth;
}

