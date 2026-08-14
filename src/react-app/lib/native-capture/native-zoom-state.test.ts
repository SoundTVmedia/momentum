import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NATIVE_ZOOM_MIN_INTERVAL_MS } from '@/react-app/lib/native-capture';

vi.mock('@/react-app/lib/native-bridge', () => ({
  isNativeApp: () => true,
  getNativePlatform: () => 'ios',
}));

const { cameraPreview } = vi.hoisted(() => ({
  cameraPreview: {
    start: vi.fn().mockResolvedValue(undefined),
    setPreviewSize: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getZoom: vi.fn(),
    getZoomButtonValues: vi.fn(),
    setZoom: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capgo/camera-preview', () => ({ CameraPreview: cameraPreview }));

vi.mock('@feedback/native-audio-capture', () => ({
  NativeAudioCapture: {
    prepareForVideoCapture: vi.fn().mockResolvedValue(undefined),
    restoreForMediaPlayback: vi.fn().mockResolvedValue(undefined),
  },
}));

type NativeCapture = typeof import('@/react-app/lib/native-capture');
let readNativeZoomState: NativeCapture['readNativeZoomState'];
let setNativeCaptureZoom: NativeCapture['setNativeCaptureZoom'];
let setNativeCaptureFocus: NativeCapture['setNativeCaptureFocus'];
let beginNativeCapturePinchZoom: NativeCapture['beginNativeCapturePinchZoom'];
let flushNativeCaptureZoom: NativeCapture['flushNativeCaptureZoom'];

describe('readNativeZoomState', () => {
  beforeAll(async () => {
    const mod = await import('@/react-app/lib/native-capture');
    readNativeZoomState = mod.readNativeZoomState;
    setNativeCaptureZoom = mod.setNativeCaptureZoom;
    setNativeCaptureFocus = mod.setNativeCaptureFocus;
    beginNativeCapturePinchZoom = mod.beginNativeCapturePinchZoom;
    flushNativeCaptureZoom = mod.flushNativeCaptureZoom;
    // Preview must be running before the plugin will report zoom.
    await mod.startNativeCapturePreview({ facing: 'rear' });
  }, 20_000);

  beforeEach(() => {
    cameraPreview.getZoom.mockResolvedValue({ min: 0.5, max: 25.5, current: 1 });
    cameraPreview.getZoomButtonValues.mockResolvedValue({ values: [0.5, 1, 3] });
  });

  it('exposes the device lens stops plus the app stops the plugin omits', async () => {
    await expect(readNativeZoomState()).resolves.toEqual({
      min: 0.5,
      max: 25.5,
      current: 1,
      presets: [0.5, 1, 2, 3],
    });
  });

  it('still reports zoom when the device cannot list lens stops', async () => {
    cameraPreview.getZoomButtonValues.mockRejectedValue(new Error('Camera not initialized'));

    const state = await readNativeZoomState();

    expect(state?.presets).toEqual([0.5, 1, 2, 3]);
  });

  it('returns null when zoom itself is unavailable', async () => {
    cameraPreview.getZoom.mockRejectedValue(new Error('Camera not initialized'));

    await expect(readNativeZoomState()).resolves.toBeNull();
  });
});

describe('setNativeCaptureZoom', () => {
  const pinch = { ramp: true, autoFocus: false, continuous: true } as const;

  beforeEach(() => {
    cameraPreview.setZoom.mockClear();
    cameraPreview.setZoom.mockResolvedValue(undefined);
    beginNativeCapturePinchZoom();
  });

  it('targets ~30 Hz for continuous pinch', () => {
    expect(NATIVE_ZOOM_MIN_INTERVAL_MS).toBe(32);
  });

  it('collapses a burst of pinch updates to the first and last target', async () => {
    // Device logs showed ~100 setZoom calls per clip because native setZoom returns
    // faster than the next touchmove, so in-flight coalescing never tripped.
    const burst = Array.from({ length: 200 }, (_, i) => 1 + i * 0.01);

    burst.forEach((level) => {
      void setNativeCaptureZoom(level, pinch);
    });
    await flushNativeCaptureZoom();

    expect(cameraPreview.setZoom.mock.calls.length).toBeLessThanOrEqual(2);
    const applied = cameraPreview.setZoom.mock.calls.map(([arg]) => arg.level);
    expect(applied[applied.length - 1]).toBe(burst[burst.length - 1]);
    expect(cameraPreview.setZoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ ramp: true, autoFocus: false }),
    );
  });

  it('never runs two zoom calls against the device at once', async () => {
    let concurrent = 0;
    let peak = 0;
    cameraPreview.setZoom.mockImplementation(async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 1));
      concurrent -= 1;
    });

    await Promise.all(
      Array.from({ length: 50 }, (_, i) => setNativeCaptureZoom(1 + i * 0.02)),
    );
    await flushNativeCaptureZoom();

    expect(peak).toBe(1);
  });

  it('leaves the final target applied rather than a stale intermediate', async () => {
    await Promise.all([
      setNativeCaptureZoom(1),
      setNativeCaptureZoom(2),
      setNativeCaptureZoom(4),
    ]);
    await flushNativeCaptureZoom();

    const applied = cameraPreview.setZoom.mock.calls.map(([arg]) => arg.level);
    expect(applied[applied.length - 1]).toBe(4);
  });

  it('honours an explicit autoFocus:false so pinch does not hunt focus', async () => {
    void setNativeCaptureZoom(2, pinch);
    await flushNativeCaptureZoom();

    expect(cameraPreview.setZoom).toHaveBeenCalledWith(
      expect.objectContaining({ level: 2, autoFocus: false, ramp: true }),
    );
  });

  it('does not send a pinch update more often than NATIVE_ZOOM_MIN_INTERVAL_MS', async () => {
    vi.useFakeTimers();
    try {
      void setNativeCaptureZoom(1, pinch);
      await vi.advanceTimersByTimeAsync(0);
      expect(cameraPreview.setZoom).toHaveBeenCalledTimes(1);
      expect(cameraPreview.setZoom).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: 1, ramp: true }),
      );

      void setNativeCaptureZoom(1.5, pinch);
      void setNativeCaptureZoom(2, pinch);
      await vi.advanceTimersByTimeAsync(NATIVE_ZOOM_MIN_INTERVAL_MS - 1);
      expect(cameraPreview.setZoom).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(cameraPreview.setZoom).toHaveBeenCalledTimes(2);
      expect(cameraPreview.setZoom).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: 2, ramp: true }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps a 12s pinch at about 30 Hz instead of one call per touchmove', async () => {
    vi.useFakeTimers();
    try {
      const touchMoveMs = 16;
      const clipMs = 12_000;
      let level = 1;
      for (let t = 0; t < clipMs; t += touchMoveMs) {
        level = 1 + (t / clipMs) * 2;
        void setNativeCaptureZoom(level, pinch);
        await vi.advanceTimersByTimeAsync(touchMoveMs);
      }
      await flushNativeCaptureZoom();

      const maxCalls = Math.ceil(clipMs / NATIVE_ZOOM_MIN_INTERVAL_MS) + 2;
      expect(cameraPreview.setZoom.mock.calls.length).toBeLessThanOrEqual(maxCalls);
      expect(cameraPreview.setZoom.mock.calls.length).toBeGreaterThan(clipMs / 200);
      const applied = cameraPreview.setZoom.mock.calls.map(([arg]) => arg.level);
      expect(applied[applied.length - 1]).toBeCloseTo(level, 5);
      expect(cameraPreview.setZoom.mock.calls.every(([arg]) => arg.ramp === true)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('setNativeCaptureFocus', () => {
  beforeEach(() => {
    cameraPreview.setFocus.mockClear();
    cameraPreview.setFocus.mockResolvedValue(undefined);
  });

  it('sends clamped 0–1 coordinates to the plugin', async () => {
    await setNativeCaptureFocus(0.25, 0.75);
    expect(cameraPreview.setFocus).toHaveBeenCalledWith({ x: 0.25, y: 0.75 });

    await setNativeCaptureFocus(-0.2, 1.4);
    expect(cameraPreview.setFocus).toHaveBeenLastCalledWith({ x: 0, y: 1 });
  });
});

describe('capgo pinch ramp patch', () => {
  it('keeps a velocity-matched native zoom ramp', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const patch = readFileSync(
      resolve(process.cwd(), 'patches/@capgo+camera-preview+7.5.0.patch'),
      'utf8',
    );
    expect(patch).toContain('FEEDBACK PINCH RAMP PATCH');
    expect(patch).toContain('octaves / 0.04');
  });
});
