export type CameraZoomRange = {
  min: number;
  max: number;
  step?: number;
};

type ZoomCapableSettings = MediaTrackSettings & { zoom?: number };
type ZoomCapableCapabilities = MediaTrackCapabilities & { zoom?: CameraZoomRange };

export function readCameraZoomRange(
  track: MediaStreamTrack | null | undefined,
): CameraZoomRange | null {
  if (!track || track.kind !== 'video' || typeof track.getCapabilities !== 'function') {
    return null;
  }

  const zoom = track.getCapabilities().zoom as CameraZoomRange | undefined;
  if (!zoom || typeof zoom.min !== 'number' || typeof zoom.max !== 'number') return null;
  if (zoom.max <= zoom.min + 0.01) return null;

  return {
    min: zoom.min,
    max: zoom.max,
    step: typeof zoom.step === 'number' && zoom.step > 0 ? zoom.step : undefined,
  };
}

export function clampCameraZoom(zoom: number, range: CameraZoomRange): number {
  let z = Math.min(range.max, Math.max(range.min, zoom));
  if (range.step && range.step > 0) {
    z = Math.round(z / range.step) * range.step;
    z = Math.min(range.max, Math.max(range.min, z));
  }
  return Math.round(z * 100) / 100;
}

/** iPhone-style preset stops within the device zoom range. */
export function buildCameraZoomPresets(range: CameraZoomRange): number[] {
  const candidates = [0.5, 1, 2, 3, 5, 10];
  const inRange = candidates
    .filter((z) => z >= range.min - 0.05 && z <= range.max + 0.05)
    .map((z) => clampCameraZoom(z, range));

  let presets: number[];
  if (inRange.length >= 2) {
    presets = inRange;
  } else {
    presets = [clampCameraZoom(range.min, range)];
    const one = clampCameraZoom(1, range);
    if (one > presets[0] + 0.05 && one < range.max - 0.05) presets.push(one);
    const max = clampCameraZoom(range.max, range);
    if (max > presets[presets.length - 1] + 0.05) presets.push(max);
  }

  return [...new Set(presets)].sort((a, b) => a - b);
}

export function readCurrentCameraZoom(
  track: MediaStreamTrack | null | undefined,
  range: CameraZoomRange | null,
): number {
  if (!track || !range || typeof track.getSettings !== 'function') return 1;
  const settings = track.getSettings() as ZoomCapableSettings;
  if (typeof settings.zoom === 'number' && Number.isFinite(settings.zoom)) {
    return clampCameraZoom(settings.zoom, range);
  }
  return clampCameraZoom(1, range);
}

export async function applyCameraZoom(
  track: MediaStreamTrack,
  zoom: number,
  range: CameraZoomRange,
): Promise<boolean> {
  const value = clampCameraZoom(zoom, range);
  const withAdvanced = { advanced: [{ zoom: value }] } as MediaTrackConstraints;
  const withDirect = { zoom: value } as MediaTrackConstraints;

  try {
    await track.applyConstraints(withAdvanced);
    return true;
  } catch {
    try {
      await track.applyConstraints(withDirect);
      return true;
    } catch {
      return false;
    }
  }
}

/** Label for zoom pill — active selection shows a × suffix like iOS Camera. */
export function formatCameraZoomLabel(zoom: number, active: boolean): string {
  const nearOne = Math.abs(zoom - 1) < 0.06;
  if (nearOne) return active ? '1×' : '1';
  if (zoom < 1) {
    const text = Number.isInteger(zoom) ? String(zoom) : zoom.toFixed(1).replace(/\.0$/, '');
    return active ? `${text}×` : text;
  }
  const text = Number.isInteger(zoom) ? String(zoom) : zoom.toFixed(1).replace(/\.0$/, '');
  return active ? `${text}×` : text;
}

export function touchPairDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function zoomFromPinchScale(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
  range: CameraZoomRange,
): number {
  if (startDistance <= 0 || currentDistance <= 0) return startZoom;
  const ratio = currentDistance / startDistance;
  return clampCameraZoom(startZoom * ratio, range);
}
