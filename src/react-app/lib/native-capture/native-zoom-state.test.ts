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
};

vi.mock('@capgo/camera-preview', () => ({ CameraPreview: cameraPreview }));

vi.mock('@feedback/native-audio-capture', () => ({
  NativeAudioCapture: {
    prepareForVideoCapture: vi.fn().mockResolvedValue(undefined),
    restoreForMediaPlayback: vi.fn().mockResolvedValue(undefined),
  },
}));

let readNativeZoomState: typeof import('@/react-app/lib/native-capture').readNativeZoomState;

describe('readNativeZoomState', () => {
  beforeAll(async () => {
    const mod = await import('@/react-app/lib/native-capture');
    readNativeZoomState = mod.readNativeZoomState;
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
