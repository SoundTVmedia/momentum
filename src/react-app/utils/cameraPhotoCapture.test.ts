import { describe, expect, it } from 'vitest';
import { normalizeCaptureDimensions } from '@/react-app/utils/cameraPreview';

describe('normalizeCaptureDimensions', () => {
  it('swaps landscape sensor pixels for portrait capture', () => {
    expect(normalizeCaptureDimensions('portrait', 1920, 1080)).toEqual({
      width: 1080,
      height: 1920,
    });
  });
});

describe('photoBlobToStillVideoBlob', () => {
  it('encodes a JPEG as a short WebM when MediaRecorder is available', async () => {
    if (typeof MediaRecorder === 'undefined' || typeof createImageBitmap === 'undefined') {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#336699';
    ctx.fillRect(0, 0, 64, 64);

    const photo = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/jpeg', 0.9);
    });

    const { photoBlobToStillVideoBlob } = await import('@/react-app/utils/cameraPhotoCapture');
    const video = await photoBlobToStillVideoBlob(photo, 200);
    expect(video.size).toBeGreaterThan(0);
    expect(video.type.startsWith('video/')).toBe(true);
  });
});
