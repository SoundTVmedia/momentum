import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/react-app/lib/native-bridge', () => ({
  isNativeApp: () => true,
  getNativePlatform: () => 'ios',
}));

const { cameraPreview } = vi.hoisted(() => ({
  cameraPreview: {
    start: vi.fn().mockResolvedValue(undefined),
    setPreviewSize: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getZoom: vi.fn().mockResolvedValue({ min: 0.5, max: 25.5, current: 1 }),
    getZoomButtonValues: vi.fn().mockResolvedValue({ values: [0.5, 1, 3] }),
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

const root = process.cwd();
const patchPath = resolve(root, 'patches/@capgo+camera-preview+7.5.0.patch');
const controllerPath = resolve(
  root,
  'node_modules/@capgo/camera-preview/ios/Sources/CapgoCameraPreviewPlugin/CameraController.swift',
);

describe('native video stabilization', () => {
  beforeAll(async () => {
    const { startNativeCapturePreview } = await import('@/react-app/lib/native-capture');
    await startNativeCapturePreview({ facing: 'rear' });
  }, 20_000);

  it('starts Capgo in cameraMode so the session uses a video preset, not .photo', () => {
    expect(cameraPreview.start).toHaveBeenCalledWith(
      expect.objectContaining({
        cameraMode: true,
        enableVideoMode: true,
        toBack: true,
        position: 'rear',
      }),
    );
  });

  it('ships the prepare/running apply path that engaged cinematic on device', () => {
    const patch = readFileSync(patchPath, 'utf8');
    const controller = readFileSync(controllerPath, 'utf8');

    for (const src of [patch, controller]) {
      expect(src).toContain('FEEDBACK STABILIZATION PATCH');
      expect(src).toContain('applyVideoRecordingPreset');
      expect(src).toContain('.hd1920x1080');
      expect(src).toContain('self.applyFeedbackVideoStabilization(reason: "prepare")');
      expect(src).toContain('self.applyFeedbackVideoStabilization(reason: "running")');
      expect(src).toContain(
        'self.applyFeedbackVideoStabilization(reason: "record-start", logOnly: true)',
      );
      expect(src).toContain('[.cinematic, .standard, .auto]');
    }
  });

  it('does not change preferredVideoStabilizationMode while recording', () => {
    const controller = readFileSync(controllerPath, 'utf8');
    const recordStart = controller.slice(
      controller.indexOf('reason: "record-start"'),
      controller.indexOf('reason: "record-start"') + 80,
    );
    expect(recordStart).toContain('logOnly: true');
  });
});
