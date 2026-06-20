import { describe, expect, it } from 'vitest';
import { cameraPreviewHasFrames, cameraPreviewLooksReady } from './cameraPreview';

describe('cameraPreview', () => {
  it('requires non-zero dimensions for hasFrames', () => {
    const video = { videoWidth: 0, videoHeight: 0, readyState: 0 } as HTMLVideoElement;
    expect(cameraPreviewHasFrames(video)).toBe(false);
    Object.assign(video, { videoWidth: 720, videoHeight: 1280 });
    expect(cameraPreviewHasFrames(video)).toBe(true);
  });

  it('looks ready when current data is available (non-strict)', () => {
    const video = {
      videoWidth: 0,
      videoHeight: 0,
      readyState: 2,
    } as HTMLVideoElement;
    expect(cameraPreviewLooksReady(video)).toBe(true);
  });

  it('strict mode waits for decoded frame dimensions (Safari)', () => {
    const video = {
      videoWidth: 0,
      videoHeight: 0,
      readyState: 2,
    } as HTMLVideoElement;
    expect(cameraPreviewLooksReady(video, { strictFrames: true })).toBe(false);
    Object.assign(video, { videoWidth: 640, videoHeight: 480 });
    expect(cameraPreviewLooksReady(video, { strictFrames: true })).toBe(true);
  });
});
