export type CameraZoomRange = {
  min: number;
  max: number;
  step?: number;
};

type ZoomCapableSettings = MediaTrackSettings & { zoom?: number };
type ZoomCapableCapabilities = MediaTrackCapabilities & { zoom?: CameraZoomRange };
type ZoomMediaTrackConstraints = MediaTrackConstraints & {
  zoom?: number;
  advanced?: Array<{ zoom?: number }>;
};

/** Minimal touch point for pinch distance (works with DOM and React touch types). */
export type TouchPoint = {
  clientX: number;
  clientY: number;
};

/** DOM and React touch lists both implement `item()` without a shared iterator type. */
export type TouchPairList = {
  readonly length: number;
  item(index: number): TouchPoint | null;
};

export function readCameraZoomRange(
  track: MediaStreamTrack | null | undefined,
): CameraZoomRange | null {
  if (!track || track.kind !== 'video' || typeof track.getCapabilities !== 'function') {
    return null;
  }

  const zoom = (track.getCapabilities() as ZoomCapableCapabilities).zoom;
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

/** Capture-screen preset stops — ultrawide through 3× tele. */
export const CAPTURE_ZOOM_PRESET_CANDIDATES = [0.5, 1, 2, 3] as const;

export function buildCaptureZoomPresets(range: CameraZoomRange): number[] {
  const presets = CAPTURE_ZOOM_PRESET_CANDIDATES.filter(
    (z) => z >= range.min - 0.05 && z <= range.max + 0.05,
  ).map((z) => clampCameraZoom(z, range));
  return [...new Set(presets)].sort((a, b) => a - b);
}

/** iPhone-style preset stops within the device zoom range. */
export function buildCameraZoomPresets(range: CameraZoomRange): number[] {
  const fromCapture = buildCaptureZoomPresets(range);
  if (fromCapture.length >= 2) return fromCapture;

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
  const withAdvanced: ZoomMediaTrackConstraints = { advanced: [{ zoom: value }] };
  const withDirect: ZoomMediaTrackConstraints = { zoom: value };

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

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export type AnimateCameraZoomHandle = {
  promise: Promise<boolean>;
  cancel: () => void;
};

/** Smoothly ramp hardware zoom between presets (~300ms ease-out). */
export function animateCameraZoom(
  track: MediaStreamTrack,
  from: number,
  to: number,
  range: CameraZoomRange,
  opts?: { durationMs?: number; onStep?: (zoom: number) => void },
): AnimateCameraZoomHandle {
  const duration = opts?.durationMs ?? 300;
  const target = clampCameraZoom(to, range);
  const start = clampCameraZoom(from, range);
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
  };

  const promise = (async (): Promise<boolean> => {
    if (Math.abs(target - start) < 0.03) {
      if (cancelled) return false;
      const ok = await applyCameraZoom(track, target, range);
      if (ok && !cancelled) opts?.onStep?.(target);
      return ok && !cancelled;
    }

    const t0 = performance.now();
    let lastApplied = start;

    while (!cancelled) {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / duration);
      const z = clampCameraZoom(start + (target - start) * easeOutCubic(t), range);

      if (Math.abs(z - lastApplied) >= 0.02 || t >= 1) {
        const ok = await applyCameraZoom(track, z, range);
        if (cancelled) return false;
        if (ok) {
          lastApplied = z;
          opts?.onStep?.(z);
        }
        if (t >= 1) return ok;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    return false;
  })();

  return { promise, cancel };
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

export function touchPairDistance(touches: TouchPairList): number {
  if (touches.length < 2) return 0;
  const t0 = touches.item(0);
  const t1 = touches.item(1);
  if (!t0 || !t1) return 0;
  const dx = t0.clientX - t1.clientX;
  const dy = t0.clientY - t1.clientY;
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
