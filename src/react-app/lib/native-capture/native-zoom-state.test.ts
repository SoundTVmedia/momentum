import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/react-app/lib/native-bridge', () => ({
  isNativeApp: () => true,
  getNativePlatform: () => 'ios',
}));

const cameraPreview = {
  start: vi.fn().mockResolvedValue(undefined),
  setPreviewSize: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  getZoom: vi.fn(),
  getZoomButtonValues: vi.fn(),
  setZoom: vi.fn().mockResolvedValue(undefined),
};

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

describe('readNativeZoomState', () => {
  beforeAll(async () => {
    const mod = await import('@/react-app/lib/native-capture');
    readNativeZoomState = mod.readNativeZoomState;
    setNativeCaptureZoom = mod.setNativeCaptureZoom;
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
  beforeEach(() => {
    cameraPreview.setZoom.mockClear();
    cameraPreview.setZoom.mockResolvedValue(undefined);
  });

  it('collapses a burst of pinch updates to the first and last target', async () => {
    // A device log showed ~270 unawaited setZoom round-trips from one pinch session.
    const burst = Array.from({ length: 200 }, (_, i) => 1 + i * 0.01);

    await Promise.all(burst.map((level) => setNativeCaptureZoom(level, { ramp: false })));

    expect(cameraPreview.setZoom.mock.calls.length).toBeLessThanOrEqual(3);
    const applied = cameraPreview.setZoom.mock.calls.map(([arg]) => arg.level);
    expect(applied[0]).toBe(burst[0]);
    expect(applied[applied.length - 1]).toBe(burst[burst.length - 1]);
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

    expect(peak).toBe(1);
  });

  it('leaves the final target applied rather than a stale intermediate', async () => {
    await Promise.all([
      setNativeCaptureZoom(1),
      setNativeCaptureZoom(2),
      setNativeCaptureZoom(4),
    ]);

    const applied = cameraPreview.setZoom.mock.calls.map(([arg]) => arg.level);
    expect(applied[applied.length - 1]).toBe(4);
  });

  it('honours an explicit autoFocus:false so pinch does not hunt focus', async () => {
    await setNativeCaptureZoom(2, { ramp: false, autoFocus: false });

    expect(cameraPreview.setZoom).toHaveBeenCalledWith(
      expect.objectContaining({ level: 2, autoFocus: false }),
    );
  });
});
